const supabaseUrl = 'https://wdaxevdkxuawyqpvajyt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkYXhldmRreHVhd3lxcHZhanl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTM4MzYsImV4cCI6MjA3NTY4OTgzNn0.K8xhfgd-1R6D4hp9NYE9O6T7ZeS5XN3MNlJtcQj08GY';

window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
window.API_BASE_URL = 'https://ninja-flask-backend.onrender.com';