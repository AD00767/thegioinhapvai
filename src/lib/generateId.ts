import { doc, runTransaction, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function generateUniqueId(db: any, objectType: string, objectReference: string): Promise<string> {
  let uniqueId = '';
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    attempts++;
    // Generate exactly 9 digit string (e.g. 000000000 to 999999999)
    uniqueId = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    
    const idRef = doc(db, 'global_ids', uniqueId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const idDoc = await transaction.get(idRef);
        if (!idDoc.exists()) {
          // It's unique! Reserve it
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
        // Log the ID reservation (do not fail if audit logging fails)
        try {
          await addDoc(collection(db, 'audit_logs'), {
            action: 'ID_RESERVED',
            numericId: uniqueId,
            objectType: objectType,
            objectReference: objectReference,
            timestamp: serverTimestamp(),
            systemAction: true
          });
        } catch (logErr) {
          console.warn("Could not write audit log for ID reservation:", logErr);
        }
        return uniqueId;
      }
    } catch (e) {
      console.warn("ID reservation transaction retry attempt " + attempts, e);
    }
  }

  // Guaranteed fallback if transaction exhausts attempts
  if (!isUnique) {
    uniqueId = (Date.now() % 1000000000).toString().padStart(9, '0');
  }
  return uniqueId;
}

