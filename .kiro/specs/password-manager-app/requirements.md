# Documento dei Requisiti

## Introduzione

L'applicazione Password Manager è un sistema di gestione sicura per password, carte di credito e documenti personali. Il sistema implementa crittografia locale end-to-end per garantire che tutti i dati sensibili rimangano esclusivamente sul dispositivo dell'utente, senza mai essere trasmessi o archiviati su server esterni.

## Glossario

- **Sistema**: L'applicazione Password Manager completa
- **Vault**: Il contenitore crittografato che contiene tutti i dati dell'utente
- **Elemento**: Un singolo record (password, carta di credito, o documento)
- **PIN_Numerico**: Codice di accesso composto da 4-8 cifre numeriche
- **Crittografia_Locale**: Processo di cifratura/decifratura eseguito esclusivamente sul dispositivo
- **Generatore_Password**: Componente per la creazione di password sicure
- **Compilazione_Automatica**: Funzionalità di inserimento automatico delle credenziali

## Requisiti

### Requisito 1: Gestione Sicura del Vault

**User Story:** Come utente, voglio che i miei dati siano protetti da crittografia forte, così che nessuno possa accedervi senza la mia autorizzazione.

#### Criteri di Accettazione

1. QUANDO l'utente crea un nuovo vault, IL Sistema DEVE generare una chiave di crittografia AES-256 derivata dal PIN
2. QUANDO l'utente inserisce il PIN corretto, IL Sistema DEVE decifrare il vault e consentire l'accesso
3. QUANDO l'utente inserisce un PIN errato per 5 volte consecutive, IL Sistema DEVE bloccare l'accesso per 30 minuti
4. IL Sistema DEVE crittografare tutti i dati sensibili prima di salvarli sul dispositivo
5. QUANDO l'applicazione viene chiusa o va in background, IL Sistema DEVE bloccare automaticamente il vault dopo 5 minuti

### Requisito 2: Gestione delle Password

**User Story:** Come utente, voglio salvare e organizzare le mie password, così che possa accedere facilmente ai miei account online.

#### Criteri di Accettazione

1. QUANDO l'utente aggiunge una nuova password, IL Sistema DEVE salvare titolo, username, password, URL e note
2. QUANDO l'utente cerca una password, IL Sistema DEVE restituire risultati basati su titolo, username o URL
3. IL Generatore_Password DEVE creare password con lunghezza configurabile (8-64 caratteri)
4. IL Generatore_Password DEVE permettere di includere/escludere maiuscole, minuscole, numeri e simboli
5. QUANDO l'utente modifica una password esistente, IL Sistema DEVE mantenere uno storico delle ultime 5 versioni

### Requisito 3: Gestione delle Carte di Credito

**User Story:** Come utente, voglio salvare i dettagli delle mie carte di credito, così che possa completare rapidamente gli acquisti online.

#### Criteri di Accettazione

1. QUANDO l'utente aggiunge una carta di credito, IL Sistema DEVE salvare numero, nome titolare, data scadenza, CVV e note
2. QUANDO l'utente visualizza una carta, IL Sistema DEVE mascherare il numero mostrando solo le ultime 4 cifre
3. QUANDO l'utente richiede la visualizzazione completa, IL Sistema DEVE richiedere nuovamente il PIN
4. IL Sistema DEVE validare il formato del numero carta usando l'algoritmo di Luhn
5. QUANDO una carta sta per scadere (30 giorni), IL Sistema DEVE mostrare un avviso

### Requisito 4: Gestione dei Documenti

**User Story:** Come utente, voglio salvare documenti importanti in formato sicuro, così che possa accedervi quando necessario.

#### Criteri di Accettazione

1. QUANDO l'utente aggiunge un documento, IL Sistema DEVE supportare testo, immagini (JPG, PNG) e PDF
2. QUANDO l'utente carica un'immagine, IL Sistema DEVE crittografarla e salvarla localmente
3. IL Sistema DEVE limitare la dimensione dei file a 10MB per documento
4. QUANDO l'utente organizza i documenti, IL Sistema DEVE permettere categorizzazione con tag personalizzati
5. QUANDO l'utente cerca nei documenti, IL Sistema DEVE cercare nel titolo, contenuto testuale e tag

### Requisito 5: Interfaccia Mobile e Web

**User Story:** Come utente, voglio accedere ai miei dati sia da mobile che da web, così che possa usare l'applicazione su tutti i miei dispositivi.

#### Criteri di Accettazione

1. QUANDO l'utente accede da mobile, IL Sistema DEVE fornire un'interfaccia touch-friendly ottimizzata
2. QUANDO l'utente accede da web, IL Sistema DEVE fornire un'interfaccia desktop responsive
3. IL Sistema DEVE mantenere la sincronizzazione dei dati tra le piattaforme tramite esportazione/importazione sicura
4. QUANDO l'utente esporta i dati, IL Sistema DEVE creare un file crittografato con password
5. QUANDO l'utente importa i dati, IL Sistema DEVE validare l'integrità e decifrare usando la password fornita

### Requisito 6: Compilazione Automatica

**User Story:** Come utente, voglio che l'applicazione compili automaticamente i campi di login, così che possa accedere rapidamente ai miei account.

#### Criteri di Accettazione

1. QUANDO l'utente visita un sito web salvato, IL Sistema DEVE riconoscere l'URL e suggerire le credenziali
2. QUANDO l'utente conferma la compilazione, IL Sistema DEVE inserire username e password nei campi appropriati
3. QUANDO l'utente usa la compilazione su mobile, IL Sistema DEVE integrarsi con il sistema di autofill del dispositivo
4. IL Sistema DEVE permettere la compilazione manuale tramite copia negli appunti con auto-cancellazione dopo 30 secondi
5. QUANDO vengono rilevate credenziali duplicate per lo stesso sito, IL Sistema DEVE permettere di scegliere quale usare

### Requisito 7: Sicurezza e Privacy

**User Story:** Come amministratore di sistema, voglio garantire che tutti i dati rimangano sul dispositivo, così che la privacy dell'utente sia completamente protetta.

#### Criteri di Accettazione

1. IL Sistema DEVE eseguire tutta la crittografia localmente senza mai trasmettere dati sensibili
2. QUANDO l'applicazione viene disinstallata, IL Sistema DEVE rimuovere completamente tutti i dati crittografati
3. IL Sistema DEVE implementare protezione contro screenshot e registrazione schermo nelle sezioni sensibili
4. QUANDO l'applicazione rileva tentativi di debug o reverse engineering, IL Sistema DEVE bloccare l'accesso
5. IL Sistema DEVE utilizzare memoria sicura per le operazioni crittografiche e cancellare le chiavi dopo l'uso

### Requisito 8: Backup e Ripristino

**User Story:** Come utente, voglio poter fare backup sicuri dei miei dati, così che non li perda mai anche se cambio dispositivo.

#### Criteri di Accettazione

1. QUANDO l'utente richiede un backup, IL Sistema DEVE creare un file crittografato con tutti i dati del vault
2. QUANDO l'utente ripristina da backup, IL Sistema DEVE richiedere la password del backup e validare l'integrità
3. IL Sistema DEVE permettere backup automatici programmati (giornalieri, settimanali, mensili)
4. QUANDO viene creato un backup, IL Sistema DEVE includere metadati sulla versione e data di creazione
5. IL Sistema DEVE permettere backup multipli e gestione delle versioni (mantenere ultimi 10 backup)