import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

const APPWRITE_ENDPOINT = (import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://appwrite.agenc-ia.net/v1').trim();
const APPWRITE_PROJECT_ID = (import.meta.env.VITE_APPWRITE_PROJECT_ID || '6abdb8190017d98565f5').trim();
export const APPWRITE_DATABASE_ID = (import.meta.env.VITE_APPWRITE_DATABASE_ID || '6abdb82f002c563b2ad3').trim();
export const APPWRITE_BUCKET_ID = (import.meta.env.VITE_APPWRITE_BUCKET_ID || 'trip-attachments').trim();

export const client = new Client();

client
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const COLLECTIONS = {
  AGENCIES: 'agencies',
  AGENCY_MEMBERS: 'agency_members',
  CLIENTS: 'crm_clients',
  LEADS: 'crm_leads',
  LEAD_ACTIVITIES: 'crm_lead_activities',
  ITINERARIES: 'crm_itineraries',
  ITINERARY_DAYS: 'crm_itinerary_days',
  ITINERARY_ACTIVITIES: 'crm_itinerary_activities',
  VOUCHERS: 'crm_vouchers',
  TRIP_EXPENSES: 'crm_trip_expenses',
  TRANSACTIONS: 'crm_transactions',
  TASKS: 'crm_tasks',
  NOTIFICATIONS: 'crm_notifications',
  LIBRARY_DESTINATIONS: 'crm_library_destinations',
  LIBRARY_ITEMS: 'crm_library_items',
  AI_CONFIG: 'crm_ai_config',
  SYSTEM_SETTINGS: 'system_settings',
} as const;

export const BUCKETS = {
  TRIP_ATTACHMENTS: 'trip-attachments',
} as const;

export { ID, Query };
