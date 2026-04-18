import { supabase } from '../lib/supabase';

export const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
export const AISLES = ['13', '14', '15', '16'];
export const SHELVES = ['01', '02', '03'];

export const PRODUCTS_LIST = [
  { name: 'WD40', sku: 'WD-400-X' },
  { name: 'Castrol', sku: 'CAS-5W30-1L' },
  { name: 'Comfort', sku: 'COM-FAB-2L' },
  { name: 'Radox', sku: 'RAD-SHW-250' },
  { name: 'Surf', sku: 'SUR-CAPS-20' },
  { name: 'Radox SG Moisturise', sku: 'RAD-MOIST-500' },
  { name: 'Surf Caps', sku: 'SUR-CAPS-40' }
];

export const CHANNELS_LIST = ['Amazon', 'Shopify', 'eBay', 'TikTok', 'Groupon'];

export const seedDatabase = async () => {
  try {
    // 1. Clean up existing data to avoid conflicts (in correct order due to FK)
    // For a demo we can just truncate or delete all
    // Note: In production you'd never do this!
    await supabase.from('location_flags').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('pick_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('pick_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('channels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('product_locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('aisles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('warehouses').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Create Warehouse
    const { data: warehouse, error: wError } = await supabase
      .from('warehouses')
      .insert({ name: 'SolveXpert Demo DC', address: '123 AI Lane, Automation City' })
      .select()
      .single();
    if (wError) throw wError;

    // 3. Create Channels
    const { data: channels, error: cError } = await supabase
      .from('channels')
      .insert(CHANNELS_LIST.map(name => ({ warehouse_id: warehouse.id, name })))
      .select();
    if (cError) throw cError;

    // 4. Create Aisles & Locations
    const locationIds = [];
    for (const aisleNum of AISLES) {
      const { data: aisle, error: aError } = await supabase
        .from('aisles')
        .insert({ warehouse_id: warehouse.id, aisle_number: aisleNum })
        .select()
        .single();
      if (aError) throw aError;

      const locs = [];
      for (const sec of SECTIONS) {
        for (const shelf of SHELVES) {
          locs.push({
            aisle_id: aisle.id,
            section: sec,
            shelf: shelf,
            location_code: `${aisleNum}.${sec}.${shelf}`
          });
        }
      }
      const { data: insertedLocs, error: lError } = await supabase
        .from('locations')
        .insert(locs)
        .select();
      if (lError) throw lError;
      locationIds.push(...insertedLocs.map(l => l.id));
    }

    // 5. Create Products & Assign to Locations
    const { data: products, error: pError } = await supabase
      .from('products')
      .insert(PRODUCTS_LIST.map(p => ({ ...p, warehouse_id: warehouse.id })))
      .select();
    if (pError) throw pError;

    const productLocs = [];
    products.forEach(product => {
      // Assign each product to 2 random locations
      for (let i = 0; i < 2; i++) {
        const randLocId = locationIds[Math.floor(Math.random() * locationIds.length)];
        productLocs.push({
          product_id: product.id,
          location_id: randLocId,
          quantity_primary: Math.floor(Math.random() * 100) + 10
        });
      }
    });
    const { error: plError } = await supabase.from('product_locations').insert(productLocs);
    if (plError) throw plError;

    // 6. Generate 50 Orders
    for (let i = 1; i <= 50; i++) {
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const { data: order, error: oError } = await supabase
        .from('orders')
        .insert({
          warehouse_id: warehouse.id,
          channel_id: channel.id,
          order_reference: `ORD-${Math.random().toString(36).substring(7).toUpperCase()}`,
          status: 'pending'
        })
        .select()
        .single();
      if (oError) throw oError;

      const numItems = Math.floor(Math.random() * 3) + 1;
      const orderItems = [];
      for (let j = 0; j < numItems; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        orderItems.push({
          order_id: order.id,
          product_id: product.id,
          quantity: Math.floor(Math.random() * 3) + 1
        });
      }
      await supabase.from('order_items').insert(orderItems);
    }

    return { success: true };
  } catch (error) {
    console.error('Seeding error:', error);
    return { success: false, error: error.message };
  }
};
