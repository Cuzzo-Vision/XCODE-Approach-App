import { User, Chat } from './types';

export const APP_COLORS = {
  primary: '#FF0000',
  background: '#000000',
  text: '#FFFFFF',
};

export const GEMINI_MODEL = 'gemini-3-flash-preview';

// Pointing to the specific image URL provided
//export const APP_BRAND_IMAGE = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTgYbOchjGhfqP1RsQc2fSChjE1g1HjDZwqnoYeMeSk34Fu225l'; 
export const APP_BRAND_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/approach-673e0.firebasestorage.app/o/profilePictures%2Fsystem%2Fapp_logo_1769320968068.png?alt=media&token=8d1cf4e2-de9c-47fb-80d8-978153f0aada';

// Mock Data to make the UI functional without live Firebase connection
export const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    firstName: 'Alice',
    lastName: 'Johnson',
    status: 'Open To Being Approached',
    approachStyle: 'Just say hi and smile! 😊',
    picture: 'https://picsum.photos/200/200?random=1',
  },
  {
    id: '2',
    name: 'Bob Smith',
    firstName: 'Bob',
    lastName: 'Smith',
    status: 'Not Open To Being Approached Right Now',
    approachStyle: 'I prefer to approach others first.',
    picture: 'https://picsum.photos/200/200?random=2',
  },
  {
    id: '3',
    name: 'Charlie Davis',
    firstName: 'Charlie',
    lastName: 'Davis',
    status: 'On a date, Please Do Not Approach',
    approachStyle: 'Please respect my time with my date.',
    picture: 'https://picsum.photos/200/200?random=3',
  },
];

export const MOCK_CHATS: Chat[] = [
  {
    id: '1',
    name: 'Jane Doe',
    lastMessage: 'Hey! How are you?',
    avatar: 'https://picsum.photos/200/200?random=4',
  },
  {
    id: '2',
    name: 'John Doe',
    lastMessage: 'Let’s talk later 👍',
    avatar: 'https://picsum.photos/200/200?random=5',
  },
];

export const CURRENT_USER_MOCK: User = {
  id: '99',
  name: 'Demo User',
  firstName: 'Demo',
  lastName: 'User',
  email: 'demo@approach.app',
  phone: '555-0199',
  status: 'Open To Being Approached',
  approachStyle: 'Friendly wave works best.',
  picture: 'https://picsum.photos/200/200?random=99',
};