import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.VITE_PB_URL || 'https://pb.home.nkorobkov.com';

export const pb = new PocketBase(PB_URL);
