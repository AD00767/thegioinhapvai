import { db } from './server/firebase';

async function generateAdminUniqueId(objectType: string, objectReference: string): Promise<string> {
  let uniqueId = '';
  let isUnique = false;
  
  while (!isUnique) {
    uniqueId = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const idRef = db.collection('global_ids').doc(uniqueId);
    
    try {
      await db.runTransaction(async (transaction) => {
        const idDoc = await transaction.get(idRef);
        if (!idDoc.exists) {
          transaction.set(idRef, { 
            numericId: uniqueId,
            objectType: objectType,
            objectReference: objectReference,
            status: 'reserved',
            createdAt: new Date().toISOString()
          });
          isUnique = true;
        }
      });
      if (isUnique) {
          await db.collection('audit_logs').add({
              action: 'ID_RESERVED',
              numericId: uniqueId,
              objectType: objectType,
              objectReference: objectReference,
              timestamp: new Date().toISOString(),
              systemAction: true
          });
      }
    } catch (e) {
      console.warn("Collision, retrying...");
    }
  }
  return uniqueId;
}

async function runMigration() {
  console.log("Migrating users...");
  const usersSnap = await db.collection("users").get();
  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    if (!data.numericId) {
      const nid = await generateAdminUniqueId("user", docSnap.id);
      await docSnap.ref.update({ numericId: nid });
      console.log(`Updated user ${docSnap.id} with ${nid}`);
    }
  }

  console.log("Migrating characters...");
  const charSnap = await db.collection("characters").get();
  for (const docSnap of charSnap.docs) {
    const data = docSnap.data();
    if (!data.numericId) {
      const nid = await generateAdminUniqueId("character", docSnap.id);
      await docSnap.ref.update({ numericId: nid });
      console.log(`Updated character ${docSnap.id} with ${nid}`);
    }
  }

  console.log("Migrating prompts...");
  const promptSnap = await db.collection("prompts").get();
  for (const docSnap of promptSnap.docs) {
    const data = docSnap.data();
    if (!data.numericId) {
      const nid = await generateAdminUniqueId("prompt", docSnap.id);
      await docSnap.ref.update({ numericId: nid });
      console.log(`Updated prompt ${docSnap.id} with ${nid}`);
    }
  }

  console.log("Migration complete.");
}

runMigration().catch(console.error);
