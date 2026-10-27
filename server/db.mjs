import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, chmodSync, realpathSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
export const hash = (s) => createHash('sha256').update(s).digest('hex');
export function validateDatabasePath(
  path,
  {
    persistentRequired = process.env.PERSISTENT_DATABASE_REQUIRED === 'true',
    cwd = process.cwd(),
  } = {},
) {
  if (!persistentRequired) return path;
  if (!isAbsolute(path))
    throw new Error(
      'Persistent database requires an absolute DATABASE_PATH outside the deployment.',
    );
  const target = resolve(/* turbopackIgnore: true */ path);
  let ancestor = target;
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
  const physical = resolve(realpathSync(ancestor), relative(ancestor, target));
  const rel = relative(cwd, physical);
  if (
    (!rel.startsWith('..') && !isAbsolute(rel)) ||
    /\/(public_html|hbuilds|\.next|public|dist)(\/|$)/i.test(physical.replaceAll('\\', '/'))
  )
    throw new Error('DATABASE_PATH must be outside public and deployment folders.');
  return target;
}
export function openDb(path = process.env.DATABASE_PATH || './data/xelograph.sqlite') {
  path = validateDatabasePath(path);
  if (path !== ':memory:')
    mkdirSync(dirname(resolve(/* turbopackIgnore: true */ path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:' && process.platform !== 'win32') chmodSync(path, 0o600);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
  db.exec(readFileSync(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
  // Additive, transactional migration: keep each existing avatar JSON and all survey data.
  db.exec('BEGIN IMMEDIATE');
  try {
    const columns = db
      .prepare('PRAGMA table_info(alumni)')
      .all()
      .map((column) => column.name);
    if (!columns.includes('avatar_revision'))
      db.exec(
        'ALTER TABLE alumni ADD COLUMN avatar_revision INTEGER NOT NULL DEFAULT 1 CHECK(avatar_revision > 0)',
      );
    if (!columns.includes('avatar_updated_at'))
      db.exec('ALTER TABLE alumni ADD COLUMN avatar_updated_at TEXT');
    const responseColumns = db
      .prepare('PRAGMA table_info(responses)')
      .all()
      .map((column) => column.name);
    if (!responseColumns.includes('completion_basis'))
      db.exec("ALTER TABLE responses ADD COLUMN completion_basis TEXT NOT NULL DEFAULT 'game'");
    const adminColumns = db
      .prepare('PRAGMA table_info(admin_sessions)')
      .all()
      .map((column) => column.name);
    if (!adminColumns.includes('credential_hash'))
      db.exec("ALTER TABLE admin_sessions ADD COLUMN credential_hash TEXT NOT NULL DEFAULT ''");
    db.exec('UPDATE alumni SET avatar_updated_at=created_at WHERE avatar_updated_at IS NULL');
    db.exec('INSERT OR IGNORE INTO user_wallets(alumni_id, coins_balance) SELECT id, 100 FROM alumni');
    const insertItem = db.prepare(
      'INSERT OR IGNORE INTO store_items(id, name, category, price_coins, model_url, preview_url, description) VALUES(?,?,?,?,?,?,?)',
    );
    insertItem.run(
      'topi_beret_bear',
      'Topi Beret Telinga Beruang',
      'headwear',
      50,
      '/models/topi_beret_bear.glb',
      '/branding/store/topi_beret_bear.png',
      'Topi beret kotak-kotak lucu dengan sepasang telinga beruang dan pita manis.',
    );
    insertItem.run(
      'pixel_sunglasses',
      'Kacamata Pixel Thug Life',
      'eyewear',
      40,
      '/models/pixel_sunglasses.glb',
      '/branding/store/pixel_sunglasses.png',
      'Kacamata 8-bit voxel "Deal With It" legendaris dengan glint piksel putih.',
    );
    insertItem.run(
      'anime_sunglasses',
      'Kacamata Anime Cyber Wing',
      'eyewear',
      40,
      '/models/anime_sunglasses.glb',
      '/branding/store/anime_sunglasses.png',
      'Kacamata anime futuristik berujung sayap runcing bergaya Kamina Gurren Lagann.',
    );
    // Row 4 Tops Collection (30 Koin per baju)
    insertItem.run(
      'row4_01_varsity_black',
      'Varsity Jacket Hitam Putih',
      'outfit',
      30,
      '/models/row4_01_varsity_black.glb',
      '/branding/store/row4_01_varsity_black.png',
      'Jaket varsity wol hitam dengan lengan kulit putih, double striped rib, kancing snap logam, dan welt pocket.',
    );
    insertItem.run(
      'row4_02_track_blue',
      'Track Jacket Biru Garis Putih',
      'outfit',
      30,
      '/models/row4_02_track_blue.glb',
      '/branding/store/row4_02_track_blue.png',
      'Jaket olahraga biru elektrik dengan blok garis putih melintang di dada dan lengan serta resleting tengah.',
    );
    insertItem.run(
      'row4_03_track_stripes',
      'Track Jacket Hitam Garis Lengan',
      'outfit',
      30,
      '/models/row4_03_track_stripes.glb',
      '/branding/store/row4_03_track_stripes.png',
      'Jaket track hitam pekat dengan strip racing putih ganda di sepanjang lengan dan resleting penuh.',
    );
    insertItem.run(
      'row4_04_halfzip_cream',
      'Sweater Half-Zip Krem',
      'outfit',
      30,
      '/models/row4_04_halfzip_cream.glb',
      '/branding/store/row4_04_halfzip_cream.png',
      'Pullover fleece krem lembut dengan kerah corong terbuka, placket half-zip gelap, dan bandul resleting perak.',
    );
    insertItem.run(
      'row4_05_halfzip_green',
      'Sweater Half-Zip Hijau Label',
      'outfit',
      30,
      '/models/row4_05_halfzip_green.glb',
      '/branding/store/row4_05_halfzip_green.png',
      'Pullover hijau botol dengan placket half-zip putih kontras dan patch label retro di dada kiri.',
    );
    insertItem.run(
      'row4_06_polo_brown',
      'Sweater Polo Cokelat Kerah Putih',
      'outfit',
      30,
      '/models/row4_06_polo_brown.glb',
      '/branding/store/row4_06_polo_brown.png',
      'Sweater rajut cokelat karamel berkerah kemeja putih runcing berlapis di atas leher V-neck elegan.',
    );
    insertItem.run(
      'row4_07_crewneck_charcoal',
      'Crewneck Charcoal Garis Gelap',
      'outfit',
      30,
      '/models/row4_07_crewneck_charcoal.glb',
      '/branding/store/row4_07_crewneck_charcoal.png',
      'Sweatshirt arang gelap klasik dengan kerah bulat, aksen segitiga V-insert, dan garis ganda di pinggang.',
    );
    insertItem.run(
      'row4_08_formal_tie',
      'Kemeja Putih Dasi Hitam',
      'outfit',
      30,
      '/models/row4_08_formal_tie.glb',
      '/branding/store/row4_08_formal_tie.png',
      'Kemeja putih rapi lengan pendek berlipat dengan dasi formal hitam bersimpul Windsor dan saku dada.',
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}
