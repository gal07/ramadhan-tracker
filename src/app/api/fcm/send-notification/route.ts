import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

// Lazy initialize Firebase Admin to avoid breaking app if not configured
let admin: any = null;
let db: any = null;

function initializeAdmin() {
  if (admin) return admin;

  try {
    const adminSDK = require('firebase-admin');
    
    // Only initialize if credentials are provided
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.warn('Firebase Admin credentials not configured');
      return null;
    }

    if (!adminSDK.apps.length) {
      admin = adminSDK.initializeApp({
        credential: adminSDK.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      admin = adminSDK.app();
    }

    db = adminSDK.firestore();
    return admin;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminApp = initializeAdmin();
    if (!adminApp) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK not configured. Please add FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL to .env.local' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { userEmail, title, body: messageBody, data } = body;

    if (!userEmail || !title || !messageBody) {
      return NextResponse.json(
        { error: 'userEmail, title, and body are required' },
        { status: 400 }
      );
    }

    // Get user's FCM tokens from Firestore
    const tokensSnapshot = await db
      .collection('users')
      .doc(userEmail)
      .collection('fcm_tokens')
      .get();

    if (tokensSnapshot.empty) {
      return NextResponse.json(
        { error: 'No FCM tokens found for this user' },
        { status: 404 }
      );
    }

    // Collect all tokens
    const tokens: string[] = [];
    tokensSnapshot.forEach((doc: any) => {
      tokens.push(doc.data().token);
    });

    // Send notification to all user's devices
    const message = {
      notification: {
        title,
        body: messageBody,
      },
      data: data || {},
      tokens,
    };

    const messaging = require('firebase-admin').messaging();
    const response = await messaging.sendEachForMulticast(message);

    // Clean up invalid tokens
    const tokensToDelete: string[] = [];
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success) {
        console.error('Failed to send to token:', tokens[idx], resp.error);
        
        // If token is invalid, mark for deletion
        if (
          resp.error?.code === 'messaging/invalid-registration-token' ||
          resp.error?.code === 'messaging/registration-token-not-registered'
        ) {
          tokensToDelete.push(tokens[idx]);
        }
      }
    });

    // Delete invalid tokens from Firestore
    if (tokensToDelete.length > 0) {
      const batch = db.batch();
      for (const token of tokensToDelete) {
        const tokenDocs = await db
          .collection('users')
          .doc(userEmail)
          .collection('fcm_tokens')
          .where('token', '==', token)
          .get();
        
        tokenDocs.forEach((doc: any) => {
          batch.delete(doc.ref);
        });
      }
      await batch.commit();
      console.log(`Deleted ${tokensToDelete.length} invalid tokens`);
    }

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      message: `Sent to ${response.successCount} device(s)`,
    });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
