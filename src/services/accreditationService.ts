import { db } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { UserProfile } from '../types';

export function generateSuggestedPasscode(name: string): string {
  const clean = (name || 'Vicino').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `${clean}${digits}`;
}

export interface AccreditationResult {
  status: 'authenticated' | 'created' | 'suffixed' | 'error';
  user: UserProfile;
  message: string;
  assignedNickname?: string;
}

/**
 * Accreditamento Auto-Gestito Ultra-Free:
 * Associa a ogni nome un codice/password (es. Nome + 6 cifre o lettere/numeri/simboli a scelta).
 * - Se il nome esiste e il codice coincide -> Login immediato e recupero karma/dati.
 * - Se il nome esiste ma il codice è diverso -> Assegna automaticamente suffisso numerico (es. Nome_1, Nome_2).
 * - Se il nome non esiste -> Crea nuovo profilo con quel nome e codice.
 * - Se dimentica il codice -> Si perde tutto e si ricomincia con un nuovo accreditamento.
 */
export async function accreditUser(
  rawNickname: string,
  rawPasscode: string,
  baseProfile?: Partial<UserProfile> | null
): Promise<AccreditationResult> {
  const nickname = rawNickname.trim();
  const passcode = rawPasscode.trim() || generateSuggestedPasscode(nickname);

  if (!nickname) {
    throw new Error('Inserisci un nome valido per l\'accreditamento.');
  }

  try {
    const usersRef = collection(db, 'help_users');
    const q = query(usersRef, where('nickname', '==', nickname));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      const existingData = existingDoc.data() as UserProfile & { passcode?: string };

      // Se il codice corrisponde: autenticazione immediata!
      if (existingData.passcode === passcode) {
        const updatedProfile: UserProfile = {
          ...existingData,
          location: baseProfile?.location || existingData.location,
          offers: baseProfile?.offers && baseProfile.offers.length > 0 ? baseProfile.offers : existingData.offers,
        };

        // Salva stato aggiornato
        await setDoc(doc(db, 'help_users', existingDoc.id), JSON.parse(JSON.stringify({
          ...updatedProfile,
          passcode,
          lastLoginAt: Date.now(),
        })), { merge: true });

        localStorage.setItem('help_user_profile', JSON.stringify(updatedProfile));
        return {
          status: 'authenticated',
          user: updatedProfile,
          message: `Bentornato, ${nickname}! Profilo accreditato e sincronizzato con successo.`,
        };
      } else {
        // Nome già occupato con codice diverso -> Trova il primo suffisso numerico libero
        let suffix = 1;
        let candidateName = `${nickname}_${suffix}`;
        let nameOccupied = true;

        // Recupera tutti gli utenti per verificare collisioni sui suffissi
        const allUsersSnap = await getDocs(usersRef);
        const existingNames = new Set(allUsersSnap.docs.map((d) => (d.data() as any).nickname));

        while (existingNames.has(candidateName)) {
          suffix++;
          candidateName = `${nickname}_${suffix}`;
        }

        const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newProfile: UserProfile = {
          id: newUserId,
          nickname: candidateName,
          passcode,
          location: baseProfile?.location || { lat: 45.6836, lng: 8.7071, address: 'Somma Lombardo (VA)' },
          offers: baseProfile?.offers && baseProfile.offers.length > 0 ? baseProfile.offers : ['Spesa e Commissioni a Domicilio'],
          requests: [],
          credits: 5,
          rating: 5.0,
          helpedCount: 0,
          karma: 100,
          createdAt: Date.now(),
        };

        await setDoc(doc(db, 'help_users', newUserId), JSON.parse(JSON.stringify({
          ...newProfile,
          passcode,
          lastLoginAt: Date.now(),
        })));

        localStorage.setItem('help_user_profile', JSON.stringify(newProfile));

        return {
          status: 'suffixed',
          user: newProfile,
          assignedNickname: candidateName,
          message: `Il nome "${nickname}" è già riservato con un altro codice. Ti è stato assegnato automaticamente "${candidateName}".`,
        };
      }
    }

    // Nome libero -> Crea accreditamento originale
    const newUserId = baseProfile?.id || ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const newProfile: UserProfile = {
      id: newUserId,
      nickname,
      passcode,
      location: baseProfile?.location || { lat: 45.6836, lng: 8.7071, address: 'Somma Lombardo (VA)' },
      offers: baseProfile?.offers && baseProfile.offers.length > 0 ? baseProfile.offers : ['Spesa e Commissioni a Domicilio', 'Piccoli Lavoretti Domestici'],
      requests: baseProfile?.requests || [],
      credits: baseProfile?.credits ?? 5,
      rating: baseProfile?.rating ?? 5.0,
      helpedCount: baseProfile?.helpedCount ?? 0,
      karma: baseProfile?.karma ?? 100,
      createdAt: baseProfile?.createdAt || Date.now(),
    };

    await setDoc(doc(db, 'help_users', newUserId), JSON.parse(JSON.stringify({
      ...newProfile,
      passcode,
      lastLoginAt: Date.now(),
    })));

    localStorage.setItem('help_user_profile', JSON.stringify(newProfile));

    return {
      status: 'created',
      user: newProfile,
      message: `Accreditamento completato con successo! Il tuo codice personale è: ${passcode}`,
    };
  } catch (err: any) {
    console.error('Accreditation error:', err);
    // Fallback locale in caso di disconnessione
    const fallbackUser: UserProfile = {
      id: baseProfile?.id || ('usr_' + Date.now()),
      nickname,
      passcode,
      location: baseProfile?.location || { lat: 45.6836, lng: 8.7071, address: 'Somma Lombardo (VA)' },
      offers: baseProfile?.offers || ['Spesa e Commissioni a Domicilio'],
      requests: [],
      credits: 5,
      rating: 5.0,
      helpedCount: 0,
      karma: 100,
      createdAt: Date.now(),
    };
    localStorage.setItem('help_user_profile', JSON.stringify(fallbackUser));
    return {
      status: 'created',
      user: fallbackUser,
      message: `Accreditamento salvato in locale con codice ${passcode}.`,
    };
  }
}

/**
 * Accesso rapido da un altro dispositivo inserendo Nome + Codice
 */
export async function loginWithCredentials(
  nicknameInput: string,
  passcodeInput: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const nickname = nicknameInput.trim();
  const passcode = passcodeInput.trim();

  if (!nickname || !passcode) {
    return { success: false, error: 'Inserisci sia il nome che il codice segreto.' };
  }

  try {
    const q = query(collection(db, 'help_users'), where('nickname', '==', nickname));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        success: false,
        error: `Nessun accreditamento trovato con il nome "${nickname}". Verifica il nome oppure crea un nuovo accreditamento.`,
      };
    }

    const userData = snapshot.docs[0].data() as UserProfile & { passcode?: string };
    if (userData.passcode !== passcode) {
      return {
        success: false,
        error: 'Il codice non è corretto per questo nome. Se hai dimenticato il codice, puoi creare un nuovo accreditamento (con suffisso automatico).',
      };
    }

    localStorage.setItem('help_user_profile', JSON.stringify(userData));
    return { success: true, user: userData };
  } catch (err: any) {
    return { success: false, error: err.message || 'Errore di connessione durante la verifica del codice.' };
  }
}
