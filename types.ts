
export interface EmojiGift {
  id: string;
  emoji: string;
  name: string;
  price: number;
  description: string;
  rarity: 'Common' | 'Rare' | 'Legendary';
}

export interface GiftTransaction {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  emojiId: string;
  emoji: string;
  timestamp: string;
}

export interface BankDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  routingNumber: string;
  accountType: 'Checking' | 'Savings';
  verified: boolean;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  birthdate?: string;
  status: string;
  approachStyle: string;
  picture: string;
  photoPath?: string;
  photos?: string[]; 
  gender?: string;
  preference?: string;
  city?: string;
  state?: string;
  zip?: string;
  access?: string; 
  membershipActive?: boolean;
  membershipDate?: string;
  updatedAt?: string;
  lastUpdateDetails?: string;
  following?: string[]; 
  sentRequests?: string[]; 
  receivedRequests?: string[]; 
  declinedRequests?: string[]; 
  sentIntroComments?: Record<string, string>;
  fcmToken?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  inventory?: {
    emojiId: string;
    count: number;
  }[];
  receivedGifts?: GiftTransaction[];
}

export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  avatar: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  createdAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface IcebreakerResponse {
  opener: string;
  advice: string;
  confidenceScore: number;
}

export enum ScenarioType {
  CASUAL = 'Casual',
  FUNNY = 'Funny',
  DIRECT = 'Direct',
  ROMANTIC = 'Romantic'
}
