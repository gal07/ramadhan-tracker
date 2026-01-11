import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

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

    const body = await request.json();
    const { token, userAgent } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Save FCM token to Firestore under user's FCM tokens collection
    const userEmail = session.user.email;
    const tokensRef = collection(db, 'users', userEmail, 'fcm_tokens');
    const tokenDocId = token.substring(0, 20); // Use first 20 chars as doc ID

    await setDoc(
      doc(tokensRef, tokenDocId),
      {
        token,
        userAgent,
        createdAt: new Date(),
        lastUsed: new Date(),
      },
      { merge: true }
    );

    console.log(`FCM token saved for user: ${userEmail}`);

    return NextResponse.json(
      { message: 'FCM token saved successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return NextResponse.json(
      { error: 'Failed to save FCM token' },
      { status: 500 }
    );
  }
}
