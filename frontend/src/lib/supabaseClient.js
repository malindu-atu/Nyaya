import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dvedihftsryhuulhdgjy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2ZWRpaGZ0c3J5aHV1bGhkZ2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkwNjEsImV4cCI6MjA4ODc3NTA2MX0.Hor5dRjx2JivuVQ00G71KKZ2j_QjBkxhRbJUaA3dz3w'
export const supabase = createClient(supabaseUrl, supabaseKey)