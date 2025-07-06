// scripts/seed.mjs
import fs from 'node:fs';
import path from 'path';
import { neon, Pool } from '@neondatabase/serverless';
import tags from './tags.mjs'
import 'dotenv/config'
// --- CONFIGURATION ---

const DATA_DIR = path.join(process.cwd(), 'data', 'georgia');
console.log(`Using data directory: ${DATA_DIR}`);

// --- DATABASE CONNECTION ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => console.error(err)); // deal with e.g. re-connect

// --- HELPER FUNCTIONS ---

class StructuredCard {
  constructor({title, description, img_src = '', img_alt = '', items = [], footer = ''}) {
    this.type = 'structured_card';
    this.structured_card = {
      title: title,
      description: description,
      img_src: img_src,
      img_alt: img_alt,
      items: items,
      footer: footer
    };
  }
}

class ParagraphBlock {
  constructor(text = '', title = '') {
    this.type = 'paragraph';
    this.text = text;
    this.title = title
  }
}

class listBlock {
  constructor(items, title = '') {
    this.type = 'list';
    this.items = items;
    this.title = title
  }
}

class ContentBlock {
  constructor(title, description, content = [], img_src = '', img_alt = '', items = [], footer = '') {
    this.title = title;
    this.description = description;
    this.content = content;
    this.img_src = img_src;
    this.img_alt = img_alt;
    this.items = items;
    this.footer = footer;
  }
  addStructuredCard(structuredCard) {
    this.content.push({
      type: 'structured_card',
      structured_card: structuredCard
    });
  }
  addParagraph(text, target) {
    this[target].push({
      type: 'paragraph',
      text: text
    });
  }
  addList(items, target) {
    this[target].push({
      type: 'list',
      items: items
    });
  }
}

class PageTemplate {
  constructor(slug, title, meta_description, status = 'draft', published_at = new Date().toISOString(), jsonData = [], topics = []) {
    this.slug = slug;
    this.title = title;
    this.meta_description = meta_description;
    this.status = status;
    this.published_at = published_at;
    this.jsonData = jsonData;
    this.topics = topics;
  }
}

// Guarantee a value is always an array
function asArray(val) {
  if (Array.isArray(val)) return val;
  if (val == null) return [];
  return [val];
}
// Normalize a card into ordered blocks
function normalizeCard(card) {
  const blocks = [];
  let order = 0;

  // Heading
  blocks.push({ type: 'heading_h1', payload: { text: card.title }, order: order++ });

  // Image
  if (card.img_src) {
    blocks.push({
      type: 'image',
      payload: { image_path: card.img_src, alt_text: card.img_alt },
      order: order++
    });
  }

  // Description blocks
  for (const desc of asArray(card.description)) {
    blocks.push({ type: desc.type, payload: desc, order: order++ });
  }

  // Content blocks
  for (const c of asArray(card.content)) {
    if (c.type === 'structured_card') {
      // c.structured_card is the object you want to insert
      blocks.push({ type: 'structured_card', payload: c.structured_card, order: order++ });
    } else {
      blocks.push({ type: c.type, payload: c, order: order++ });
    }
  }

  // Footer
  if (card.footer) {
    blocks.push({
      type: 'paragraph',
      payload: { text: `Read more: <a href="${card.footer}">Explore further</a>` },
      order: order++
    });
  }

  return blocks;
}
const findProperty = (obj, nameToFind, propertyToReturn) => {
  const foundProperty = obj.find(item => item.type === nameToFind);
  return foundProperty ? foundProperty[propertyToReturn] : null;
}
function mergeArraysByKey(arr1, arr2, key) {
    const map = new Map();
      arr1.forEach(item => {
    map.set(item[key], { ...item });
  });
    arr2.forEach(item => {
    if (map.has(item[key])) {
      const existingItem = map.get(item[key]);
      map.set(item[key], { ...existingItem, ...item });
    } else {
      map.set(item[key], { ...item });
    }
  });
    return Array.from(map.values());
}

function loadAllJson(dir) {
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .flatMap(filePath => {
      const raw = fs.readFileSync(path.join(dir, filePath), 'utf8');
      const data = JSON.parse(raw);
      return {
        "slug": filePath.slice(0, -5),
        "title": filePath.slice(0, -5).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        "meta_description": `Seed data for ${filePath.slice(0, -5)}`,
        "status": "published",
        "published_at": new Date().toISOString(),
        "jsonData": Array.isArray(data) ? data : [data]};
    });
}
function transformForSeed(src) {
  const {
    slug,
    jsonData
  } = src;
  let topics
  switch (slug) {
    case 'general':
      let listItems = jsonData.filter(card => card.description !== null && card.description !== undefined)
      .map(card => {
        return {
          title: card.title,
          content: findProperty(card.description, 'paragraph', 'text') || '',
          img_src: card.img_src || '',
          img_alt: card.img_alt || '',
          items: findProperty(card.description, 'list', 'items') || [],
          footer: card.footer || ''
        };
      });
      let contentItems = jsonData.filter(card => card.content !== null && card.content !== undefined)
      .map(card => {
        return {
          title: card.title,
          content: findProperty(card.content, 'paragraph', 'text') || '',
          img_src: card.img_src || '',
          img_alt: card.img_alt || '',
          items: findProperty(card.content, 'list', 'items') || [],
          footer: card.footer || ''
        };
      });
      const mergedArray = mergeArraysByKey(listItems, contentItems, 'title');

      const newJSONData_General = new ContentBlock(
        "Culture and Traditions of Georgia",
        new ParagraphBlock(
          "Explore the rich culture and traditions of Georgia, from its ancient history to modern practices."
        ),
        mergedArray.map((card) => {
          return new StructuredCard({
            title: card.title,
            description: new ParagraphBlock(
              card.content || ''
            ) || '',
            img_src: card.img_src || '',
            img_alt: card.img_alt || '',
            items: card.items || [],
            footer: card.footer || ''
          });
        }),
      );
        jsonData.length = 0; // Clear the original jsonData array
        jsonData.push(newJSONData_General);
        topics = tags.general;
      break;
    case 'history':
      const newJSONData_History = new ContentBlock(
        "History of Georgia",
        new ParagraphBlock(
          "Discover the rich and diverse history of Georgia, from ancient civilizations to modern times."
        ),
        jsonData.map((card) => {
          return new StructuredCard({
            title: card.title,
            description: card.content.map((content) => {
              return new ParagraphBlock(
                content.text || ''
              );
            }) || '',
            img_src: card.img_src || '',
            img_alt: card.img_alt || '',
            items: card.items || [],
            footer: card.footer || ''
          });
        }),
      );
      jsonData.length = 0;
      jsonData.push(newJSONData_History);
      topics = tags.history;
      break;
    case 'culture':

        const newJSONData_Culture = new ContentBlock(
        "Culture and Traditions of Georgia",
        new ParagraphBlock(
          "Explore the rich culture and traditions of Georgia, from its ancient history to modern practices."
        ),
        jsonData.map((card) => {
          return new StructuredCard({
            title: card.title,
            description: card.content.map((content) => {
              return new ParagraphBlock(
                content.text || ''
              )
            }) || '',
            img_src: card.img_src || '',
            img_alt: card.img_alt || '',
            items: card.items || [],
            footer: card.footer || ''
          });
        }),
      );
        jsonData.length = 0; // Clear the original jsonData array
        jsonData.push(newJSONData_Culture);
      topics = tags.culture;
      break;
    case 'nature':
      const newJSONData_Nature = new ContentBlock(
        "Explore Georgia's Natural Wonders",
        new ParagraphBlock(
          'From soaring Caucasus peaks to lush Black Sea coastlines, Georgia’s landscapes offer unparalleled diversity. Discover ancient forests, hidden caves, vibrant wetlands, and more in this guide to the country’s most breathtaking natural destinations.'
        ),
        jsonData.map((card) => {
          return new StructuredCard({
            title: card.title,
            description: card.content.map((content) => {
              return new ParagraphBlock(
                content.text
              )
            }) || '',
            img_src: card.img_src || '',
            img_alt: card.img_alt || '',
            items: card.items || [],
            footer: card.footer || '',
          });
        })
        );
        jsonData.length = 0;
        jsonData.push(newJSONData_Nature)
      topics = tags.nature;
      break;
    case 'adventures':
      const newJSONData_Adventures = new ContentBlock(
        jsonData[0].title || "Adventures in Georgia",
        new ParagraphBlock(
          jsonData[0].intro || "Discover thrilling adventures in Georgia, from hiking in the Caucasus mountains to exploring ancient caves."
        ),
        jsonData.map((card) => {
          return new StructuredCard({
            title: card.name || '',
            description: new ParagraphBlock(
              card.description || ''
            ),
            img_src: card.imageSrc || '',
            img_alt: card.imageAlt || '',
            items: card.location || [],
            footer: card.footer || ''
          });
        })
      );
      jsonData.length = 0; // Clear the original jsonData array
      jsonData.push(newJSONData_Adventures);

      topics = tags.adventure;
      break;
    case 'cuisine':
      const newJSONData_Cuisine = new ContentBlock(
        jsonData[0].page.title || "Cuisine of Georgia",
        new ParagraphBlock(
          jsonData[0].page.intro || "Explore the rich and diverse flavors of Georgia through the lens of its distinct regions. From the wine-soaked valleys of Kakheti to the alpine pastures of Tusheti, discover traditional dishes, hidden gems, and where to taste them authentically."
        ),
        jsonData[0].page.sections.map((section) => {
          return new StructuredCard({
            title: section.title || '',
            description: section.intro === '' ? '' : new ParagraphBlock(
              section.intro || ''
            ),
            img_src: section.img_src || '',
            img_alt: section.img_alt || '',
            items: new listBlock(
              section.dishes ? section.dishes.map(dish => ({ dish })) : []
            ),
            footer: new listBlock(section.venues, "Venues") || ''
          });
        })
      );
      jsonData.length = 0; // Clear the original jsonData array
      jsonData.push(newJSONData_Cuisine);
      topics = tags.cuisine;
      break;
    case 'guide':
      const newGuidePage = new ContentBlock(
        "Guided Tours in Georgia",
        new ParagraphBlock(
          "Discover the best guided tours in Georgia, from cultural experiences to adventure activities."
        ),
        jsonData.map((card) => {
          return new StructuredCard({
            title: card.name,
            description: new ParagraphBlock(
              card.intro || ''
            ),
            img_src: card.imageSrc || '',
            img_alt: card.imageAlt || '',
            items: card.description || [],
            footer: card.footer || ''
          }
          );
        })
      );
      jsonData.length = 0; // Clear the original jsonData array
      jsonData.push(newGuidePage);
      topics = tags.guide;
      break;
    case 'health':
      const newJSONData_Health = jsonData.map((card) => {
        return new ContentBlock(
          card.title || "Health and Wellness in Georgia",
          new ParagraphBlock(
            card.intro || "Explore health and wellness options in Georgia, from traditional remedies to modern practices."
          ),
          card.options.map((option) => {
            return new StructuredCard({
              title: option.subtext || '',
              description: new ParagraphBlock(
                option.description || ''
              ),
              img_src: option.imageSrc || '',
              img_alt: option.imageAlt || '',
              items: option.locations.map((location) => {
                return new StructuredCard({
                  title: location.name,
                  description: '',
                  img_src: location.imageSrc || '',
                  img_alt: location.imageAlt || '',
                  items: [location.location]
                });
              }) || [],
              footer: option.footer || ''
            });
          }),
          card.imageSrc || '',
          card.imageAlt || '',
          new ParagraphBlock(
            card.description || ''
          )
        );
      });
      jsonData.length = 0; // Clear the original jsonData array
      jsonData.push(...newJSONData_Health);
      topics = tags.health;
      break;
    case 'nightlife':
      const nightlifeTransform = [];
      for (const [key, value] of Object.entries(jsonData[0])) {
        nightlifeTransform.push({
          title: key,
          content: value
        });
      };
      const newJSONData_Nightlife = new ContentBlock(
        'Experience Georgia After Dark',
        new ParagraphBlock(
          'Dive into Georgia’s vibrant nightlife, where ancient streets pulse with modern beats and every corner hides a new adventure. From Tbilisi’s underground techno temples to Batumi’s beach-side dance floors, the night is yours to explore.'
        ),
        nightlifeTransform.map((content) => {
          return new StructuredCard({
            title: content.title,
            description: '',
            img_src: '',
            img_alt: '',
            items: new listBlock(
              content.content.map((card) => {
              return new StructuredCard({
                title: card.name,
                description: new ParagraphBlock(
                  card.description
                ),
                img_src: card.img_src || '',
                img_alt: card.img_alt || '',
                items: new listBlock([
                  card.category,
                  card.type
                ]),
                footer: card.footer || ''
              });
            })
            )
          });
        })
      );
      jsonData.length = 0;
      jsonData.push(newJSONData_Nightlife)
      topics = tags.nightlife;
      break;
    case 'wine':
      const newJSONData_Wine = new ContentBlock(
        jsonData[0].page.title || "A Connoisseur's Guide to Regional Georgian Wines",
        new ParagraphBlock(jsonData[0].page.intro || "Georgia’s winemaking tradition spans 8,000 years, making it the world’s oldest wine culture. Over 525 indigenous grape varieties thrive here, and winemaking blends ancient Qvevri methods with modern techniques. From the fertile Alazani Valley in the east to the humid Black Sea coast, each region has a distinct terroir and wine personality."),
        jsonData[0].page.sections.map((section) => {
          return new StructuredCard({
            title: section.title || '',
            description: new ParagraphBlock(section.intro) || '',
            img_src: section.img_url || '',
            img_alt: section.img_alt || '',
            items: [
              new listBlock(
                section.grape_varieties,
                'Grape Varieties'
              ),
              new listBlock(
                section.winemaking_methods,
                "Winemaking Methods"
              ),
              new listBlock(
                section.wines.map((wine) => {
                  return new ParagraphBlock(
                    wine.description,
                    wine.name
                  )
                }),
                "Wines"
              )
            ],
            footer: new listBlock(
              section.wineries,
              'Wineries'
            )
          })
        })
      );
      jsonData.length = 0;
      jsonData.push(newJSONData_Wine);
      topics = tags.wine;
      break;
    default:
  }
  return new PageTemplate(
    src.slug,
    src.title,
    src.meta_description || `Seed data for ${src.slug}`,
    src.status || 'draft',
    src.published_at || new Date().toISOString(),
    src.jsonData || [],
    topics || []
  );
}

const INPUT_DIR = path.join(process.cwd(), 'data', 'georgia');
const georgiaData = loadAllJson(INPUT_DIR);
// const OUTPUT_PATH = path.join(process.cwd(), 'data', 'georgia', 'seeded.json');
const seededData = georgiaData.map(transformForSeed);

async function upsertTopic(client, topicName) {
    const slug = topicName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
    const res = await client.query(
        `INSERT INTO topics (name, slug) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [topicName, slug]
    );
    return res.rows[0].id;
}

// --- MAIN SEEDING LOGIC ---
async function main() {
const client = await pool.connect();
console.log('✅ Connected to the database.');

  try {
    // Wrap the entire seed process in a transaction.
    // If any part fails, the whole process will be rolled back.
    await client.query('BEGIN');
    console.log('🚀 Starting transaction...');

    await client.query(`SET search_path TO georgia_horizons`);
    console.log('Using database: georgia-horizons');

    // 1. Define the page and its associated JSON data
    for (const pageData of seededData) {
      // --- SEED A SINGLE PAGE ---
    
    console.log(`\nSeeding page: "${pageData.title}"...`);
    
    // Insert the page into the `pages` table
    const pageInsertResult = await client.query(
      `INSERT INTO pages (slug, title, meta_description, status, published_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [pageData.slug, pageData.title, pageData.meta_description, pageData.status, pageData.published_at]
    );

    const pageId = pageInsertResult.rows[0].id;
    console.log(`  - Inserted page with ID: ${pageId}`);
    
    // Insert topics and associate them with the page
    for (const topicName of pageData.topics) {
        const topicId = await upsertTopic(client, topicName);
        await client.query(
            `INSERT INTO page_topics (page_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [pageId, topicId]
        );
        console.log(`  - Associated with topic: "${topicName}" (ID: ${topicId})`);
    }
      for (const card of pageData.jsonData) {
        console.log(`  - Processing card: "${card.title}"`);
        const blocks = normalizeCard(card);
        for (const blk of blocks) {
          if (blk.type === 'structured_card') {
            const sc = blk.payload;
            await client.query(
              `INSERT INTO structured_cards
                 (page_id, card_title, card_description, items, img_src, img_alt, footer, order_on_page)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [pageId, sc.title, JSON.stringify(sc.description), JSON.stringify(sc.items), sc.img_src, sc.img_alt, JSON.stringify(sc.footer), blk.order]
            );
          } else {
            await client.query(
              `INSERT INTO content_blocks (page_id, type, content_data, order_on_page)
               VALUES ($1, $2, $3, $4)`,
              [pageId, blk.type, JSON.stringify(blk.payload), blk.order]
            );
          }
        }
      }

      console.log(`✅ Successfully seeded page: "${pageData.title}"`);
    }
    // --- END OF SEEDING A SINGLE PAGE ---

    await client.query('COMMIT');
    console.log('\n✅ Transaction committed. Database seeded successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ An error occurred. Transaction rolled back.');
    console.error(error);
  } finally {
    client.release();
    await pool.end();
    console.log('👋 Database connection closed.');
  }
}

// Run the main function
main().catch(console.error);

