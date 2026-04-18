export const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
export const AISLES = ['13', '14', '15', '16'];
export const SHELVES = ['01', '02', '03'];

export const PRODUCTS = ['WD40', 'Castrol', 'Comfort', 'Radox', 'Surf'];
export const CHANNELS = ['Amazon', 'Shopify', 'eBay', 'TikTok', 'Groupon'];

export const PACKING_STATION = { x: 250, y: 20 };

export const getCoordinates = (aisle, section) => {
  const sectionIndex = SECTIONS.indexOf(section);
  const startY = 80;
  const sectionHeight = 35; 
  const y = startY + sectionIndex * sectionHeight;
  
  if (aisle === '13' || aisle === '14') {
    // Corridor 1 is at x = 120
    // But let's offset the dot slightly based on the aisle to make it visually clear
    // 13 is LHS, 14 is RHS
    return { x: aisle === '13' ? 100 : 140, y };
  } else if (aisle === '15' || aisle === '16') {
    // Corridor 2 is at x = 380
    return { x: aisle === '15' ? 360 : 400, y };
  }
  return { x: 250, y: 50 }; // default
};

// Generate 50 mock orders
export const generateOrders = () => {
  const orders = [];
  for (let i = 1; i <= 50; i++) {
    const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
    const numItems = Math.floor(Math.random() * 3) + 1; // 1 to 3 items per order
    const items = [];
    
    for (let j = 0; j < numItems; j++) {
      const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const aisle = AISLES[Math.floor(Math.random() * AISLES.length)];
      const section = SECTIONS[Math.floor(Math.random() * SECTIONS.length)];
      const shelf = SHELVES[Math.floor(Math.random() * SHELVES.length)];
      
      const { x, y } = getCoordinates(aisle, section);
      
      items.push({
        id: `Item-${i}-${j}`,
        orderId: `ORD-${i.toString().padStart(4, '0')}`,
        product,
        channel,
        aisle,
        section,
        shelf,
        x,
        y
      });
    }
    
    orders.push({
      id: `ORD-${i.toString().padStart(4, '0')}`,
      channel,
      items
    });
  }
  return orders;
};

// Naive Route: sequential order per channel
export const calculateNaiveRoute = (orders) => {
  let path = [];
  
  // Group by channel
  const ordersByChannel = {};
  CHANNELS.forEach(c => ordersByChannel[c] = []);
  orders.forEach(o => ordersByChannel[o.channel].push(o));
  
  let currentPos = { ...PACKING_STATION };
  let distance = 0;
  
  const calculateDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  
  path.push({ ...currentPos, label: 'Start' });
  
  for (const channel of CHANNELS) {
    for (const order of ordersByChannel[channel]) {
      // Walk to each item in the order
      for (const item of order.items) {
        distance += calculateDistance(currentPos, item);
        path.push({ x: item.x, y: item.y, item });
        currentPos = { x: item.x, y: item.y };
      }
      // Return to packing station after every order in naive pick!
      distance += calculateDistance(currentPos, PACKING_STATION);
      path.push({ ...PACKING_STATION, isReturn: true });
      currentPos = { ...PACKING_STATION };
    }
  }
  
  return { path, distance: Math.round(distance), time: Math.round(distance / 50) };
};

// Optimised Route: batch all items, snake pattern
export const calculateOptimisedRoute = (orders) => {
  let path = [];
  let distance = 0;
  
  // Extract all items into a single batch
  let batchItems = [];
  orders.forEach(o => {
    o.items.forEach(i => batchItems.push(i));
  });
  
  const calculateDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

  // Snake pattern sorting:
  // 1. Aisle 13 and 14: sort by Section A -> N (Y increases)
  // 2. Aisle 15 and 16: sort by Section N -> A (Y decreases)
  
  const corridor1Items = batchItems.filter(i => i.aisle === '13' || i.aisle === '14');
  const corridor2Items = batchItems.filter(i => i.aisle === '15' || i.aisle === '16');
  
  corridor1Items.sort((a, b) => {
    return SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section);
  });
  
  corridor2Items.sort((a, b) => {
    return SECTIONS.indexOf(b.section) - SECTIONS.indexOf(a.section);
  });
  
  let currentPos = { ...PACKING_STATION };
  path.push({ ...currentPos, label: 'Start' });
  
  // Walk corridor 1
  for (const item of corridor1Items) {
    // If we only visit coordinates when the Y changes, we could streamline,
    // but going item by item is fine for path logging.
    distance += calculateDistance(currentPos, item);
    path.push({ x: item.x, y: item.y, item });
    currentPos = { x: item.x, y: item.y };
  }
  
  // Cross over to corridor 2
  // We can add intermediate points if desired, e.g. end of corridor 1
  if (corridor1Items.length > 0 && corridor2Items.length > 0) {
    const endC1 = { x: 120, y: getCoordinates('13', 'N').y + 20 };
    const startC2 = { x: 380, y: getCoordinates('15', 'N').y + 20 };
    distance += calculateDistance(currentPos, endC1);
    path.push(endC1);
    currentPos = endC1;
    
    distance += calculateDistance(currentPos, startC2);
    path.push(startC2);
    currentPos = startC2;
  }
  
  // Walk corridor 2
  for (const item of corridor2Items) {
    distance += calculateDistance(currentPos, item);
    path.push({ x: item.x, y: item.y, item });
    currentPos = { x: item.x, y: item.y };
  }
  
  // Return to packing station
  distance += calculateDistance(currentPos, PACKING_STATION);
  path.push({ ...PACKING_STATION, isReturn: true });
  
  return { path, distance: Math.round(distance), time: Math.round(distance / 50) };
};

export const calculateSessionMetrics = (pickItems, session) => {
  if (!pickItems || !Array.isArray(pickItems)) {
    return { distance: 0, distanceSaved: 0, timeSavedMinutes: 0, pph: 0, accuracy: 100 };
  }

  // 1. Map locations to coordinates
  const items = pickItems.map(pi => {
    if (!pi || !pi.locations || !pi.locations.location_code) return null;
    const parts = pi.locations.location_code.split('.');
    if (parts.length < 2) return null;
    const { x, y } = getCoordinates(parts[0], parts[1]);
    return { ...pi, x, y };
  }).filter(Boolean);

  if (items.length === 0) {
    return { distance: 0, distanceSaved: 0, timeSavedMinutes: 0, pph: 0, accuracy: 100 };
  }

  // 2. Calculate Optimised Path (Batch consolidated visit)
  const optResult = calculateOptimisedRoute([{ items }]);
  
  // 3. Naive Path: Sequential walk per item (even if in same location)
  const naiveDistance = items.reduce((acc, item, idx) => {
    if (idx === 0) return acc + Math.sqrt(Math.pow(item.x - PACKING_STATION.x, 2) + Math.pow(item.y - PACKING_STATION.y, 2));
    const prev = items[idx - 1];
    return acc + Math.sqrt(Math.pow(item.x - prev.x, 2) + Math.pow(item.y - prev.y, 2));
  }, 0) + Math.sqrt(Math.pow(items[items.length-1].x - PACKING_STATION.x, 2) + Math.pow(items[items.length-1].y - PACKING_STATION.y, 2));

  const distanceSaved = Math.max(0, Math.round(naiveDistance - optResult.distance));
  
  // 4. Time Metrics
  const startTime = session?.created_at ? new Date(session.created_at) : new Date();
  const now = new Date();
  const elapsedHours = Math.max(0.01, (now - startTime) / (1000 * 60 * 60));
  
  const pickedItems = pickItems.filter(pi => pi.picked).length;
  const pickedUnits = pickItems.filter(pi => pi.picked).reduce((acc, pi) => acc + (pi.quantity || 1), 0);
  
  const pph = Math.round(pickedUnits / elapsedHours);
  
  // 5. Accuracy (assuming all items picked in a completed session are accurate for demo purposes)
  const accuracy = pickItems.length > 0 ? (pickedItems / pickItems.length) * 100 : 100;

  return {
    distance: optResult.distance || 0,
    distanceSaved: distanceSaved || 0,
    timeSavedMinutes: Math.round((distanceSaved / 1.4) / 60) || 0, // 1.4 m/s walking speed
    pph,
    accuracy: Math.round(accuracy)
  };
};
