import fs from 'fs';
import path from 'path';

interface RawReview {
  id: string;
  date: string;
  product: string;
  category: string;
  rating: number;
  review_text: string;
}

// 12 Weeks calendar definition
// Let's anchor starting 12 weeks ago (e.g. 2024-01-08 to 2024-03-31)
const START_DATE = new Date('2024-01-08T10:00:00Z');

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const PRODUCTS = [
  { name: 'EchoPulse Pro', category: 'Audio' },
  { name: 'SoundWave Max', category: 'Audio' },
  { name: 'SonicBar 500', category: 'Audio' },
  { name: 'PulseFit 3', category: 'Electronics' },
  { name: 'ViewTab 10', category: 'Electronics' },
  { name: 'HyperDrive Hub', category: 'Electronics' },
  { name: 'Lumina Glow', category: 'Home' },
  { name: 'CleanBot X', category: 'Home' },
];

// Baseline positive templates
const POSITIVE_TEMPLATES = [
  'Absolutely love my {product}! Sound clarity and build quality exceeded expectations.',
  'Best purchase this year. The {product} arrived on time and functions flawlessly.',
  'Remarkable battery life and easy Bluetooth pairing. Highly recommended for daily use.',
  'Customer support helped me set up the {product} quickly. Extremely polite and helpful team!',
  'Top notch performance and premium materials. Worth every single penny.',
  'Super fast shipping and secure packaging. Works seamlessly with all my devices.',
  'Crisp audio, deep bass, and comfortable fit for long listening sessions.',
  'Sleek modern design that blends perfectly into our living room setup.',
  'Battery lasts over 30 hours on a single charge. Couldn\'t ask for better reliability.',
  'Five stars! Effortless setup right out of the box. Very satisfied with this product.',
  'Incredible value for the price. Performs better than competitors costing twice as much.',
  'Smooth experience and rock-solid connection. Will definitely recommend to friends.',
];

// Baseline neutral templates
const NEUTRAL_TEMPLATES = [
  'The {product} is decent. Works as advertised though nothing truly mind-blowing.',
  'Average build quality. Does the job for the price point, but setup took a few minutes.',
  'Standard features. Sound and battery are acceptable, shipping was on schedule.',
  'It is okay for casual use. Neither particularly impressed nor disappointed.',
  'Does what it says on the box. Packaging was basic, manual was a bit sparse.',
];

// Baseline negative templates
const BASELINE_NEGATIVE_TEMPLATES = [
  'The {product} is a bit too bulky for my pocket. Wish it was more compact.',
  'Price feels slightly steep for what you get. Expected slightly better materials.',
  'Delivery took four days longer than promised by the courier.',
  'Ear tips felt slightly stiff after a couple hours of wear.',
  'Customer support took 48 hours to reply to my warranty inquiry.',
];

// WEEK 6: FIRMWARE V3.2 DISASTER ON EchoPulse Pro
const FW_DISASTER_TEMPLATES = [
  'Firmware update v3.2 completely ruined my EchoPulse Pro! Battery drains from 100% to dead in 45 minutes.',
  'Do NOT install firmware update v3.2. Constant bluetooth disconnects and extreme battery drain!',
  'Ever since firmware update v3.2, my EchoPulse Pro keeps freezing and the left earbud loses pairing.',
  'Update v3.2 bricked my earbuds. Battery overheating and connection drops every two minutes. Huge bug!',
  'The latest v3.2 firmware patch caused severe battery drain. Software update was a disaster.',
  'Bluetooth disconnects constantly after the software update. Completely unusable during workouts.',
  'App crashed right after the v3.2 firmware update and now the battery barely lasts an hour.',
  'Horrible firmware update. Battery drain is insane and audio cuts in and out repeatedly.',
  'Firmware v3.2 glitch: left bud unpairs and battery dies instantly. Need an immediate bug fix!',
  'Update v3.2 is buggy as hell. Firmware destroyed battery runtime and audio connectivity.',
  'Earbuds get scorching hot while charging after firmware v3.2. Extremely disappointed with this software release.',
  'Battery drains even while sitting idle in the charging case since the firmware v3.2 patch.',
];

// WEEK 8: DELIVERY BOTTLENECK ON Lumina Glow
const DELIVERY_SURGE_TEMPLATES = [
  'Delivery delay on my Lumina Glow. Package was stuck at the courier hub for over 12 days!',
  'Shipping was terrible. Courier lost my tracking number and the box arrived crushed.',
  'Still waiting for delivery after two weeks. Customer support says courier is backlogged.',
  'Late delivery and damaged box upon arrival. Very poor shipping logistics.',
  'Package delayed by over 9 days without any courier updates. Unacceptable shipping delay.',
  'Courier left the parcel in the rain outside. Box soaked and shipment was two weeks late.',
];

// WEEK 10: MIXED REVIEWS (Edge Case 2)
const MIXED_TEMPLATES = [
  'The sound quality is astonishing and crystal clear, but the mobile app crashes constantly whenever I change EQ.',
  'Love the sleek hardware design and premium glass finish, however the courier took 14 days to deliver it.',
  'The ANC noise cancellation is truly top tier, but the battery drains twice as fast when transparency mode is active.',
  'Customer service representative was wonderfully courteous, however the replacement unit took three weeks to ship.',
  'Display resolution and colors look gorgeous, but the software update introduced noticeable micro-stutters.',
  'Super comfortable ergonomics and great bass, but bluetooth randomly disconnects during calls.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateSyntheticDataset(): RawReview[] {
  const reviews: RawReview[] = [];
  let reviewIdCounter = 1001;

  // 12 Weeks simulation
  for (let week = 1; week <= 12; week++) {
    const weekStart = addDays(START_DATE, (week - 1) * 7);

    // ==========================================
    // SPECIAL EDGE CASE WEEKS
    // ==========================================

    // WEEK 9: Edge Case 1 (LOW DATA - only 3 reviews total!)
    if (week === 9) {
      for (let i = 0; i < 3; i++) {
        const prod = PRODUCTS[i % PRODUCTS.length];
        const date = formatDate(addDays(weekStart, getRandomInt(1, 5)));
        reviews.push({
          id: `REV-${reviewIdCounter++}`,
          date,
          product: prod.name,
          category: prod.category,
          rating: 4,
          review_text: `Solid performance on the ${prod.name}. Build quality feels sturdy and reliable.`,
        });
      }
      continue;
    }

    // WEEK 11: Edge Case 3 (ISOLATED EVENT - 4 reviews total, 1 extreme viral 1-star complaint)
    if (week === 11) {
      // 3 normal positive reviews
      for (let i = 0; i < 3; i++) {
        const prod = PRODUCTS[i];
        const date = formatDate(addDays(weekStart, getRandomInt(1, 3)));
        reviews.push({
          id: `REV-${reviewIdCounter++}`,
          date,
          product: prod.name,
          category: prod.category,
          rating: 5,
          review_text: `Still loving my ${prod.name}. Flawless performance and great battery life.`,
        });
      }
      // 1 single viral 1-star isolated event review
      reviews.push({
        id: `REV-VIRAL-ISOLATED`,
        date: formatDate(addDays(weekStart, 4)),
        product: 'EchoPulse Pro',
        category: 'Audio',
        rating: 1,
        review_text: 'DANGER: Left earbud sparked inside the charging case while on my desk! Demanding full refund and immediate recall.',
      });
      continue;
    }

    // ==========================================
    // NORMAL & INCIDENT WEEKS (~120-140 reviews per week)
    // ==========================================
    const weeklyCount = getRandomInt(125, 145);

    for (let i = 0; i < weeklyCount; i++) {
      const dayOffset = getRandomInt(0, 6);
      const reviewDate = formatDate(addDays(weekStart, dayOffset));
      const id = `REV-${reviewIdCounter++}`;

      // WEEK 6: THE FIRMWARE UPDATE V3.2 INCIDENT
      if (week === 6) {
        // EchoPulse Pro gets flooded with firmware complaints (~65% of all weekly reviews)
        const isEchoIncident = Math.random() < 0.65;
        if (isEchoIncident) {
          const tmpl = pickRandom(FW_DISASTER_TEMPLATES);
          reviews.push({
            id,
            date: reviewDate,
            product: 'EchoPulse Pro',
            category: 'Audio',
            rating: Math.random() < 0.8 ? 1 : 2,
            review_text: tmpl,
          });
          continue;
        }
      }

      // WEEK 8: THE LUMINA GLOW COURIER DELAY INCIDENT
      if (week === 8) {
        const isLuminaDelivery = Math.random() < 0.45;
        if (isLuminaDelivery) {
          const tmpl = pickRandom(DELIVERY_SURGE_TEMPLATES);
          reviews.push({
            id,
            date: reviewDate,
            product: 'Lumina Glow',
            category: 'Home',
            rating: Math.random() < 0.7 ? 1 : 2,
            review_text: tmpl,
          });
          continue;
        }
      }

      // WEEK 10: POLARIZED / MIXED SENTIMENT WEEK (Edge Case 2)
      if (week === 10) {
        const isMixed = Math.random() < 0.50;
        if (isMixed) {
          const tmpl = pickRandom(MIXED_TEMPLATES);
          const prod = pickRandom(PRODUCTS);
          reviews.push({
            id,
            date: reviewDate,
            product: prod.name,
            category: prod.category,
            rating: 3,
            review_text: tmpl,
          });
          continue;
        }
      }

      // STANDARD DISTRIBUTION (Weeks 1-5, 7, 12, and rest of 6, 8, 10)
      const prod = pickRandom(PRODUCTS);
      const roll = Math.random();

      if (roll < 0.80) {
        // 80% Positive
        const tmpl = pickRandom(POSITIVE_TEMPLATES).replace('{product}', prod.name);
        reviews.push({
          id,
          date: reviewDate,
          product: prod.name,
          category: prod.category,
          rating: Math.random() < 0.6 ? 5 : 4,
          review_text: tmpl,
        });
      } else if (roll < 0.90) {
        // 10% Neutral
        const tmpl = pickRandom(NEUTRAL_TEMPLATES).replace('{product}', prod.name);
        reviews.push({
          id,
          date: reviewDate,
          product: prod.name,
          category: prod.category,
          rating: 3,
          review_text: tmpl,
        });
      } else {
        // 10% Baseline Negative
        const tmpl = pickRandom(BASELINE_NEGATIVE_TEMPLATES).replace('{product}', prod.name);
        reviews.push({
          id,
          date: reviewDate,
          product: prod.name,
          category: prod.category,
          rating: Math.random() < 0.6 ? 2 : 1,
          review_text: tmpl,
        });
      }
    }
  }

  return reviews;
}

function convertToCSV(reviews: RawReview[]): string {
  const header = 'id,date,product,category,rating,review_text';
  const rows = reviews.map((r) => {
    // Escape quotes in text
    const escapedText = `"${r.review_text.replace(/"/g, '""')}"`;
    return `${r.id},${r.date},${r.product},${r.category},${r.rating},${escapedText}`;
  });
  return [header, ...rows].join('\n');
}

export function writeDemoCSV(): void {
  const reviews = generateSyntheticDataset();
  const csv = convertToCSV(reviews);
  
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outPath = path.join(publicDir, 'demo_feedback.csv');
  fs.writeFileSync(outPath, csv, 'utf-8');
  console.log(`Generated ${reviews.length} demo reviews saved to: ${outPath}`);
}

// Execute when run via node/tsx
if (require.main === module || process.argv[1]?.endsWith('generate_dataset.ts')) {
  writeDemoCSV();
}
