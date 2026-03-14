export interface Suggestion {
  text: string;
  prompt: string;
}

const artStyles = ['anime', 'art nouveau', 'ukiyo-e', 'watercolor'];

const basePrompts: { text: string; prompt: string }[] = [
  {
    text: '黄昏蝾螈',
    prompt: 'A salamander at dusk in a forest pond',
  },
  {
    text: '偷窥的鸡',
    prompt:
      'A sultry chicken peering around the corner from shadows, clearly up to no good',
  },
  {
    text: '猫咪上线',
    prompt: 'A cat launching its website on Vercel',
  },
  {
    text: '小熊猫品茶',
    prompt:
      'A red panda sipping tea under cherry blossoms at sunset with Mount Fuji in the background',
  },
  {
    text: '冲浪水獭',
    prompt: 'A mischievous otter surfing the waves in Bali at golden hour',
  },
  {
    text: '蜜獾拉面',
    prompt: 'A pensive honey badger eating a bowl of ramen in Osaka',
  },
  {
    text: '禅意青蛙',
    prompt:
      'A frog meditating on a lotus leaf in a tranquil forest pond at dawn, surrounded by fireflies',
  },
  {
    text: '金刚鹦鹉传情',
    prompt:
      'A colorful macaw delivering a love letter, flying over the Grand Canyon at sunrise',
  },
  {
    text: '狐狸漫步',
    prompt: 'A fox walking through a field of lavender with a golden sunset',
  },
  {
    text: '犰狳太空行',
    prompt:
      'An armadillo in a rocket at countdown preparing to blast off to Mars',
  },
  {
    text: '企鹅的休闲时光',
    prompt: 'A penguin in pajamas eating ice cream while watching television',
  },
  {
    text: '针鼹图书馆',
    prompt:
      'An echidna reading a book in a cozy library built into the branches of a eucalyptus tree',
  },
  {
    text: '水豚温泉',
    prompt:
      'A capybara relaxing in a hot spring surrounded by snow-covered mountains with a waterfall in the background',
  },
  {
    text: '狮王宝座',
    prompt:
      'A regal lion wearing a crown, sitting on a throne in a jungle palace, with waterfalls in the distance',
  },
  {
    text: '海豚荧光',
    prompt:
      'A dolphin leaping through a glowing ring of bioluminescence under a starry sky',
  },
  {
    text: '猫头鹰侦探',
    prompt:
      'An owl wearing a monocle and top hat, solving a mystery in a misty forest at midnight',
  },
  {
    text: '水母教堂',
    prompt:
      'A jellyfish floating gracefully in an underwater cathedral made of coral and glass',
  },
  {
    text: '鸭嘴兽河畔',
    prompt: 'A platypus foraging in a river with a sunset in the background',
  },
  {
    text: '城市变色龙',
    prompt:
      'A chameleon blending into a graffiti-covered wall in an urban jungle',
  },
  {
    text: '陆龟绿洲',
    prompt:
      'A giant tortoise slowly meandering its way to an oasis in the desert',
  },
  {
    text: '蜂鸟晨曲',
    prompt:
      'A hummingbird sipping nectar from a purple bougainvillea at sunrise, captured mid-flight',
  },
  {
    text: '北极熊问候',
    prompt:
      'A polar bear clambering onto an iceberg to greet a friendly harbor seal as dusk falls',
  },
  {
    text: '狐猴日光浴',
    prompt:
      'A ring-tailed lemur sunbathing on a rock in Madagascar in early morning light',
  },
];

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getRandomSuggestions(count = 5): Suggestion[] {
  const shuffledPrompts = shuffle(basePrompts);
  const shuffledStyles = shuffle(artStyles);

  return shuffledPrompts.slice(0, count).map((item, index) => ({
    text: item.text,
    prompt: `${item.prompt}, in the style of ${
      shuffledStyles[index % shuffledStyles.length]
    }`,
  }));
}
