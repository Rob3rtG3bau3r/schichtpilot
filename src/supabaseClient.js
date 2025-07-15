import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tvnjuxexrdsuctdmmchq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2bmp1eGV4cmRzdWN0ZG1tY2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4ODc3OTUsImV4cCI6MjA2NDQ2Mzc5NX0.6dVBUFKUF8OrakUG0TCEMxkQl6n1mPrbXbB-nnUmg28'; // 🔐 <- Den findest du direkt unter "anon public" im API-Bereich

export const supabase = createClient(supabaseUrl, supabaseKey);

