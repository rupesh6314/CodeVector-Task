import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  'Electronics',
  'Books',
  'Clothing',
  'Home & Garden',
  'Sports',
  'Toys',
  'Health & Beauty',
  'Automotive',
  'Grocery',
  'Pet Supplies',
];

const BATCH_SIZE = 10000;
const TOTAL_PRODUCTS = 200000;

function generateProducts(count: number, startDate: Date) {
  const products = [];
  let currentTime = startDate.getTime();

  for (let i = 0; i < count; i++) {
    // We increment time slightly for each product so we get distinct created_at times,
    // though some might share the exact same millisecond.
    currentTime -= Math.floor(Math.random() * 60000); // subtract random up to 1 minute
    const date = new Date(currentTime);

    products.push({
      id: crypto.randomUUID(),
      name: `Product ${Math.random().toString(36).substring(2, 10)}`,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      price: parseFloat((Math.random() * 1000).toFixed(2)),
      created_at: date,
      updated_at: date,
    });
  }
  return products;
}

async function seed() {
  console.log('Starting data generation...');

  let startDate = new Date();
  let totalInserted = 0;

  try {
    while (totalInserted < TOTAL_PRODUCTS) {
      const products = generateProducts(BATCH_SIZE, startDate);
      
      await prisma.product.createMany({
        data: products,
        skipDuplicates: true
      });
      
      totalInserted += BATCH_SIZE;
      console.log(`Inserted ${totalInserted} / ${TOTAL_PRODUCTS} products...`);
      
      startDate = new Date(products[products.length - 1].created_at);//last product of the batch
    }

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}
//using this because using direct main method not imported modules 
if (require.main === module) {
  seed();
}
