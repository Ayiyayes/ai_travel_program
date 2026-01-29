import { db } from '../server/db';
import { templates } from '../drizzle/schema';

// 人群类型配置（对应 UI 设计的七大类型）
const groupTypes = [
  { code: 'shaonv', displayName: '花季少女' },
  { code: 'shunv', displayName: '熟龄姐姐' },
  { code: 'yuanqigege', displayName: '元气哥哥' },
  { code: 'ruizhidashu', displayName: '睿智大叔' },
  { code: 'ruanmengnvhai', displayName: '软萌女孩' },
  { code: 'ertong', displayName: '儿童' },
  { code: 'laonian', displayName: '长者' },
];

// 示例模板数据（根据你的 UI 截图）
const sampleTemplates = [
  {
    templateId: 'shaonv-001',
    name: '民国咖啡馆',
    imageUrl: 'https://via.placeholder.com/358x536/F5E6D3/8B7355?text=民国咖啡馆',
    thumbnailUrl: 'https://via.placeholder.com/179x268/F5E6D3/8B7355?text=民国咖啡馆',
    city: '上海',
    scenicSpot: '外滩',
    groupType: 'shaonv',
    photoType: 'single',
    faceType: 'both',
    price: 0,
    isFree: true,
    status: 'active',
    sortOrder: 1,
  },
  {
    templateId: 'shaonv-002',
    name: '敦煌飞天',
    imageUrl: 'https://via.placeholder.com/358x538/D4E4BC/6B8E23?text=敦煌飞天',
    thumbnailUrl: 'https://via.placeholder.com/179x269/D4E4BC/6B8E23?text=敦煌飞天',
    city: '敦煌',
    scenicSpot: '莫高窟',
    groupType: 'shaonv',
    photoType: 'single',
    faceType: 'both',
    price: 0,
    isFree: true,
    status: 'active',
    sortOrder: 2,
  },
  {
    templateId: 'shaonv-003',
    name: '盛唐宫廷',
    imageUrl: 'https://via.placeholder.com/357x536/FFE5B4/CD853F?text=盛唐宫廷',
    thumbnailUrl: 'https://via.placeholder.com/179x268/FFE5B4/CD853F?text=盛唐宫廷',
    city: '西安',
    scenicSpot: '大雁塔',
    groupType: 'shaonv',
    photoType: 'single',
    faceType: 'both',
    price: 0,
    isFree: true,
    status: 'active',
    sortOrder: 3,
  },
  {
    templateId: 'shaonv-004',
    name: '江南水乡',
    imageUrl: 'https://via.placeholder.com/360x540/E0C9A6/8B6914?text=江南水乡',
    thumbnailUrl: 'https://via.placeholder.com/180x270/E0C9A6/8B6914?text=江南水乡',
    city: '苏州',
    scenicSpot: '拙政园',
    groupType: 'shaonv',
    photoType: 'single',
    faceType: 'both',
    price: 0,
    isFree: true,
    status: 'active',
    sortOrder: 4,
  },
  {
    templateId: 'shaonv-005',
    name: '清凉古寺',
    imageUrl: 'https://via.placeholder.com/358x536/8B4513/FFFFFF?text=清凉古寺',
    thumbnailUrl: 'https://via.placeholder.com/179x268/8B4513/FFFFFF?text=清凉古寺',
    city: '杭州',
    scenicSpot: '灵隐寺',
    groupType: 'shaonv',
    photoType: 'single',
    faceType: 'both',
    price: 0,
    isFree: true,
    status: 'active',
    sortOrder: 5,
  },
  {
    templateId: 'shaonv-006',
    name: '云冈石窟',
    imageUrl: 'https://via.placeholder.com/358x536/D3D3D3/696969?text=云冈石窟',
    thumbnailUrl: 'https://via.placeholder.com/179x268/D3D3D3/696969?text=云冈石窟',
    city: '大同',
    scenicSpot: '云冈石窟',
    groupType: 'shaonv',
    photoType: 'single',
    faceType: 'both',
    price: 0,
    isFree: true,
    status: 'active',
    sortOrder: 6,
  },
];

async function seedTemplates() {
  try {
    console.log('开始添加测试模板数据...');

    // 插入模板数据
    for (const template of sampleTemplates) {
      await db.insert(templates).values(template);
      console.log(`✓ 已添加模板: ${template.name}`);
    }

    console.log('\n✅ 测试数据添加完成!');
    console.log(`\n📊 数据统计:`);
    console.log(`- 人群类型: ${groupTypes.length} 个`);
    console.log(`- 模板数量: ${sampleTemplates.length} 个`);
    console.log(`\n💡 提示: 现在可以在小程序中看到模板列表了！`);

    process.exit(0);
  } catch (error) {
    console.error('❌ 添加测试数据失败:', error);
    process.exit(1);
  }
}

seedTemplates();
