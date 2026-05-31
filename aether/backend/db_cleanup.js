require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

async function main() {
  console.log("🧹 Starting Supabase Listings Cleanup...");
  
  // Fetch all active/pending listings where token_id is null
  const { data: listings, error: fetchError } = await supabaseAdmin
    .from("carbon_listings")
    .select("id, species, credits, token_id, status, tx_hash");
    
  if (fetchError) {
    console.error("❌ Failed to fetch listings:", fetchError);
    process.exit(1);
  }
  
  const toDelete = [];
  
  for (const item of listings) {
    const hasValidToken = item.token_id !== null && item.token_id !== undefined;
    const hasValidTxHash = typeof item.tx_hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(item.tx_hash);
    
    // If it has no token_id, or if the tx_hash is just a signature slice (42 chars), it's unverified!
    if (!hasValidToken || !hasValidTxHash) {
      toDelete.push(item);
    }
  }
  
  console.log(`🔍 Found ${toDelete.length} unverified listings to remove out of ${listings.length} total.`);
  
  if (toDelete.length > 0) {
    const idsToDelete = toDelete.map(item => item.id);
    console.log("🗑️ Deleting IDs:", idsToDelete);
    
    const { error: deleteError } = await supabaseAdmin
      .from("carbon_listings")
      .delete()
      .in("id", idsToDelete);
      
    if (deleteError) {
      console.error("❌ Delete failed:", deleteError);
      process.exit(1);
    }
    
    console.log("✅ Successfully purged all unverified/mock listings!");
    toDelete.forEach(item => {
      console.log(`   - Removed: ${item.species} | Credits: ${item.credits} | Token ID: ${item.token_id} | Status: ${item.status}`);
    });
  } else {
    console.log("✨ No unverified listings found to purge!");
  }
}

main().catch(console.error);
