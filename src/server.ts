import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const app=express();
const PORT=process.env.PORT || 3000;

// Initialize Prisma
const prisma=new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Interface for query params
interface ProductQuery {
  category?:string;
  cursor?:string;
  limit?:string;
}

// Helper to encode cursor
function encodeCursor(createdAt:Date,id:string):string {
  return Buffer.from(JSON.stringify({ created_at:createdAt.toISOString(),id })).toString('base64');
}

// Helper to decode cursor
function decodeCursor(cursorStr:string):{created_at:Date;id:string } | null {
  try {
    const decoded=Buffer.from(cursorStr,'base64').toString('ascii');
    const parsed=JSON.parse(decoded);
    return {
      created_at:new Date(parsed.created_at),
      id: parsed.id
    };
  } 
  catch (e) {
    return null;
  }
}

app.get('/api/products',async(req: Request<{},{},{},ProductQuery>,res:Response)=>{
  try {
    const { category, cursor, limit = '20' } = req.query;
    const limitNum = parseInt(limit,10);//this converts the number to string
    //using of 10 because 10 Interpret as decimal number
    
    if (isNaN(limitNum) || limitNum<=0 || limitNum>100) {
      return res.status(400).json({ error:'Invalid limit'});
    }

    // Prepare Prisma findMany options
    //used to keep Newest product first
    const queryOptions:any={
      where:category ? { category } : {},
      orderBy:[
        { created_at:'desc'},
        { id:'desc'}
      ],
      take:limitNum+1 // Fetch one extra to determine if there's a next page
    };

    if (cursor) {
      const parsedCursor =decodeCursor(cursor);
      if (!parsedCursor) {
        return res.status(400).json({ error:'Invalid cursor'});
      }

      queryOptions.cursor = {
        created_at_id: {
          created_at:parsedCursor.created_at,
          id:parsedCursor.id
        }
      };
      queryOptions.skip =1; // Skip the actual cursor element
    }

    const rows=await prisma.product.findMany(queryOptions);

    let nextCursor=null;//initializing as it has no next pages
    const hasMore=rows.length > limitNum;
    
    //if hasMore items to load then removing the last item and making that item as the first item of the page
    if (hasMore){
      rows.pop(); // Remove the extra item
      const lastItem=rows[rows.length-1];
      nextCursor=encodeCursor(lastItem.created_at,lastItem.id);
    }

    res.json({
      data: rows,
      next_cursor: nextCursor,
      has_more: hasMore
    });

  } 
  catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simulate Live Insert endpoint
app.post('/api/products/simulate', async (req, res) => {
  try {
    const { count = 50 } = req.body || {};
    const CATEGORIES = ['Electronics', 'Books', 'Clothing', 'Home & Garden', 'Sports', 'Toys', 'Health & Beauty', 'Automotive', 'Grocery', 'Pet Supplies'];
    
    const newProducts = Array.from({ length: count }).map(() => ({
      name: `Live Product ${Math.random().toString(36).substring(2, 8)}`,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      price: parseFloat((Math.random() * 500).toFixed(2)),
      // created_at defaults to now() in schema!
    }));

    await prisma.product.createMany({
      data: newProducts
    });

    res.json({ success: true, message: `Successfully inserted ${count} live products!` });
  } 
  catch (error) {
    console.error('Error simulating insert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Categories endpoint for the UI filter
app.get('/api/categories', async (req, res) => {
  try {
    // Prisma doesn't have a distinct operator for simple arrays yet that works nicely,
    // we use groupBy which achieves SELECT DISTINCT category
    const categories = await prisma.product.groupBy({
      by: ['category'],
      orderBy: {
        category: 'asc'
      }
    });
    res.json(categories.map((c: { category: string }) => c.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clean up Prisma connection on exit
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
