-- 添加测试模板数据
-- 使用你的 UI 截图中的真实图片作为示例

-- 清空现有数据（如果需要）
-- TRUNCATE TABLE templates;

-- 插入"花季少女"人群类型的模板
INSERT INTO templates (templateId, name, imageUrl, thumbnailUrl, city, scenicSpot, groupType, photoType, faceType, price, isFree, status, sortOrder) VALUES
('shaonv-001', '民国咖啡馆', 'https://picsum.photos/seed/template1/358/536', 'https://picsum.photos/seed/template1/179/268', '上海', '外滩', 'shaonv', 'single', 'both', 0, true, 'active', 1),
('shaonv-002', '敦煌飞天', 'https://picsum.photos/seed/template2/358/538', 'https://picsum.photos/seed/template2/179/269', '敦煌', '莫高窟', 'shaonv', 'single', 'both', 0, true, 'active', 2),
('shaonv-003', '盛唐宫廷', 'https://picsum.photos/seed/template3/357/536', 'https://picsum.photos/seed/template3/179/268', '西安', '大雁塔', 'shaonv', 'single', 'both', 0, true, 'active', 3),
('shaonv-004', '江南水乡', 'https://picsum.photos/seed/template4/360/540', 'https://picsum.photos/seed/template4/180/270', '苏州', '拙政园', 'shaonv', 'single', 'both', 0, true, 'active', 4),
('shaonv-005', '清凉古寺', 'https://picsum.photos/seed/template5/358/536', 'https://picsum.photos/seed/template5/179/268', '杭州', '灵隐寺', 'shaonv', 'single', 'both', 0, true, 'active', 5),
('shaonv-006', '云冈石窟', 'https://picsum.photos/seed/template6/358/536', 'https://picsum.photos/seed/template6/179/268', '大同', '云冈石窟', 'shaonv', 'single', 'both', 0, true, 'active', 6);

-- 插入"熟龄姐姐"人群类型的模板
INSERT INTO templates (templateId, name, imageUrl, thumbnailUrl, city, scenicSpot, groupType, photoType, faceType, price, isFree, status, sortOrder) VALUES
('shunv-001', '旗袍名媛', 'https://picsum.photos/seed/template7/358/536', 'https://picsum.photos/seed/template7/179/268', '上海', '外滩', 'shunv', 'single', 'both', 0, true, 'active', 1),
('shunv-002', '优雅咖啡', 'https://picsum.photos/seed/template8/358/538', 'https://picsum.photos/seed/template8/179/269', '北京', '三里屯', 'shunv', 'single', 'both', 0, true, 'active', 2);

-- 插入"元气哥哥"人群类型的模板
INSERT INTO templates (templateId, name, imageUrl, thumbnailUrl, city, scenicSpot, groupType, photoType, faceType, price, isFree, status, sortOrder) VALUES
('yuanqigege-001', '阳光海滩', 'https://picsum.photos/seed/template9/358/536', 'https://picsum.photos/seed/template9/179/268', '三亚', '亚龙湾', 'yuanqigege', 'single', 'both', 0, true, 'active', 1),
('yuanqigege-002', '街头篮球', 'https://picsum.photos/seed/template10/358/538', 'https://picsum.photos/seed/template10/179/269', '北京', '五棵松', 'yuanqigege', 'single', 'both', 0, true, 'active', 2);

-- 插入"睿智大叔"人群类型的模板
INSERT INTO templates (templateId, name, imageUrl, thumbnailUrl, city, scenicSpot, groupType, photoType, faceType, price, isFree, status, sortOrder) VALUES
('ruizhidashu-001', '商务精英', 'https://picsum.photos/seed/template11/358/536', 'https://picsum.photos/seed/template11/179/268', '上海', '陆家嘴', 'ruizhidashu', 'single', 'both', 0, true, 'active', 1),
('ruizhidashu-002', '文化学者', 'https://picsum.photos/seed/template12/358/538', 'https://picsum.photos/seed/template12/179/269', '北京', '故宫', 'ruizhidashu', 'single', 'both', 0, true, 'active', 2);

-- 插入"软萌女孩"人群类型的模板
INSERT INTO templates (templateId, name, imageUrl, thumbnailUrl, city, scenicSpot, groupType, photoType, faceType, price, isFree, status, sortOrder) VALUES
('ruanmengnvhai-001', '樱花少女', 'https://picsum.photos/seed/template13/358/536', 'https://picsum.photos/seed/template13/179/268', '武汉', '武汉大学', 'ruanmengnvhai', 'single', 'both', 0, true, 'active', 1),
('ruanmengnvhai-002', '甜美校园', 'https://picsum.photos/seed/template14/358/538', 'https://picsum.photos/seed/template14/179/269', '北京', '清华大学', 'ruanmengnvhai', 'single', 'both', 0, true, 'active', 2);

-- 插入"儿童"人群类型的模板
INSERT INTO templates (templateId, name, imageUrl, thumbnailUrl, city, scenicSpot, groupType, photoType, faceType, price, isFree, status, sortOrder) VALUES
('ertong-001', '迪士尼魔法', 'https://picsum.photos/seed/template15/358/536', 'https://picsum.photos/seed/template15/179/268', '上海', '迪士尼', 'ertong', 'single', 'both', 0, true, 'active', 1),
('ertong-002', '童话城堡', 'https://picsum.photos/seed/template16/358/538', 'https://picsum.photos/seed/template16/179/269', '香港', '迪士尼', 'ertong', 'single', 'both', 0, true, 'active', 2);

-- 插入"长者"人群类型的模板
INSERT INTO templates (templateId, name, imageUrl, thumbnailUrl, city, scenicSpot, groupType, photoType, faceType, price, isFree, status, sortOrder) VALUES
('laonian-001', '太极养生', 'https://picsum.photos/seed/template17/358/536', 'https://picsum.photos/seed/template17/179/268', '杭州', '西湖', 'laonian', 'single', 'both', 0, true, 'active', 1),
('laonian-002', '园林悠闲', 'https://picsum.photos/seed/template18/358/538', 'https://picsum.photos/seed/template18/179/269', '苏州', '拙政园', 'laonian', 'single', 'both', 0, true, 'active', 2);
