// Administrative maintenance. Dry-run by default; never prints authentication material.
// Requires a pre-existing Firebase CLI installation and its authenticated project operator.
const path = require('node:path');
const { createRequire } = require('node:module');
const functionsRequire = createRequire(path.resolve(__dirname, '../functions/package.json'));
const admin = functionsRequire('firebase-admin');
const { remainingDates } = require('../functions/nest-booking/monthly-repeat');

async function main() {
  const args = process.argv.slice(2);
  const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const cliRoot = value('--firebase-cli');
  if (!cliRoot) throw new Error('Provide --firebase-cli with the installed firebase-tools directory.');
  const cliAuth = require(path.join(cliRoot, 'lib/auth'));
  const account = cliAuth.getProjectDefaultAccount(path.resolve(__dirname, '..'));
  if (!account?.tokens?.refresh_token) throw new Error('An authenticated Firebase CLI account is required.');
  admin.initializeApp({ projectId: 'owl-manage' });
  const db = admin.firestore();
  const { GoogleAuth, OAuth2Client } = functionsRequire('google-auth-library');
  const cliApi = require(path.join(cliRoot, 'lib/api'));
  const oauth = new OAuth2Client(cliApi.clientId(), cliApi.clientSecret());
  oauth.setCredentials({ refresh_token: account.tokens.refresh_token });
  db.settings({ auth: new GoogleAuth({ authClient: oauth, projectId: 'owl-manage' }), preferRest: true });
  const sourceMonday = value('--source', '2026-11-30');
  const month = value('--month', '2026-12');
  const actor = value('--actor');
  const apply = args.includes('--apply');
  const end = new Date(`${sourceMonday}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 4);
  const sourceEnd = end.toISOString().slice(0, 10);
  console.log(JSON.stringify({ project: 'owl-manage', sourceMonday, sourceEnd, month, mode: apply ? 'APPLY' : 'DRY_RUN' }));
  if (!actor && !apply) {
    const owners = await db.collection('users').where('role', '==', 'OWNER').get();
    console.log(JSON.stringify({ ownerAccounts: owners.docs.map((doc) => ({ uid: doc.id,
      name: doc.data().displayName || '', matchesOperator: doc.data().email === account.user.email })) }));
  }
  const plans = [];
  const sourceActors = new Map();
  for (const family of ['pilates', 'barre']) {
    const source = await db.collection('nest_bookings').where('family', '==', family).get();
    const sourceDocs = source.docs.filter((doc) => doc.data().status === 'BOOKED' &&
      doc.data().dateKey >= sourceMonday && doc.data().dateKey <= sourceEnd);
    let existing = 0;
    let pending = 0;
    for (const doc of sourceDocs) {
      const booking = doc.data();
      if (booking.bookedBy) sourceActors.set(booking.bookedBy, (sourceActors.get(booking.bookedBy) || 0) + 1);
      for (const dateKey of remainingDates(booking.dateKey, month)) {
        const target = await db.collection('nest_bookings')
          .doc(`${family}__${dateKey}__${booking.slotId}__${booking.athleteId}`).get();
        if (target.exists) existing++;
        else pending++;
      }
    }
    plans.push({ family, sourceCount: sourceDocs.length, existing, pending });
  }
  console.log(JSON.stringify({ plan: plans }));
  console.log(JSON.stringify({ sourceActors: [...sourceActors].map(([uid, count]) => ({ uid, count })) }));
  if (!apply) return;
  if (!actor) throw new Error('Apply requires --actor with an existing authorized staff UID for attribution.');
  const nest = require('../functions/nest-booking');
  const totals = { booked: 0, skipped: 0, failed: 0 };
  for (const { family } of plans) {
    const result = await nest.copyNestMonthBookings.run({ family, sourceMonday, month },
      { auth: { uid: actor, token: { maintenanceOperator: account.user.email } } });
    const failures = [];
    for (const row of result.results) {
      for (const item of row.repeated) {
        if (item.status === 'BOOKED') totals.booked++;
        else if (item.status === 'SKIPPED') totals.skipped++;
        else { totals.failed++; failures.push({ athleteId: row.athleteId, ...item }); }
      }
    }
    console.log(JSON.stringify({ family, sourceCount: result.sourceCount, failures }));
  }
  console.log(JSON.stringify({ totals }));
}

main().catch((error) => {
  // Avoid dumping HTTP request objects, auth headers or credentials from SDK errors.
  console.error(error.message || 'Administrative copy failed.');
  process.exitCode = 1;
});