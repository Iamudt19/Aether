const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: 'aether/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  console.log("Fixing incomplete transactions in DB...");
  const { data, error } = await supabase
    .from('carbon_listings')
    .update({ status: 'pending' })
    .eq('status', 'active')
    .is('token_id', null);
  
  if (error) console.error(error);
  else console.log("Fixed!", data);
}

run();
