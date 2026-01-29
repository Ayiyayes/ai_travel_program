import { describe, it, expect } from 'vitest';

describe('Tencent Map API Key Validation', () => {
  it('should have TENCENT_MAP_API_KEY configured', () => {
    const apiKey = process.env.TENCENT_MAP_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
    console.log('TENCENT_MAP_API_KEY is configured');
  });

  it('should successfully query location from Tencent Map API', async () => {
    const apiKey = process.env.TENCENT_MAP_API_KEY;
    if (!apiKey) {
      throw new Error('TENCENT_MAP_API_KEY is not configured');
    }

    // 测试查询"长沙橘子洲"的经纬度
    const keyword = encodeURIComponent('长沙橘子洲');
    const url = `https://apis.map.qq.com/ws/place/v1/search?keyword=${keyword}&boundary=region(长沙,0)&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Tencent Map API Response:', JSON.stringify(data, null, 2));
    
    // 验证 API 返回成功
    expect(data.status).toBe(0);
    expect(['query ok', 'Success']).toContain(data.message);
    expect(data.data).toBeDefined();
    expect(data.data.length).toBeGreaterThan(0);
    
    // 验证返回的经纬度
    const firstResult = data.data[0];
    expect(firstResult.location).toBeDefined();
    expect(firstResult.location.lat).toBeDefined();
    expect(firstResult.location.lng).toBeDefined();
    
    console.log(`Location found: ${firstResult.title} - lat: ${firstResult.location.lat}, lng: ${firstResult.location.lng}`);
  });
});
