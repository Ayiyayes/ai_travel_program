import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, 
  MousePointer, 
  ShoppingCart, 
  TrendingUp,
  BarChart3,
  Trophy,
  Flame,
  Sparkles,
  Filter,
} from 'lucide-react';

export default function TemplateStatsPage() {
  // 筛选条件
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [spotFilter, setSpotFilter] = useState<string>('all');
  const [groupTypeFilter, setGroupTypeFilter] = useState<string>('all');
  
  // 获取城市列表
  const { data: citiesData } = trpc.admin.cities.useQuery();
  const cities = citiesData || [];
  
  // 获取景点列表
  const { data: spotsData } = trpc.admin.spots.useQuery();
  const spots = spotsData || [];
  
  // 获取人群类型列表
  const { data: groupTypesData } = trpc.admin.groupTypes.useQuery();
  const groupTypes = groupTypesData?.filter(g => g.isActive) || [];
  
  // 根据选中的城市筛选景点
  const filteredSpots = useMemo(() => {
    if (cityFilter === 'all') return spots;
    return spots.filter(s => s.cityId === cities.find(c => c.name === cityFilter)?.id);
  }, [spots, cities, cityFilter]);
  
  // 获取统计数据
  const { data: statsData, isLoading: statsLoading } = trpc.template.stats.useQuery({
    city: cityFilter !== 'all' ? cityFilter : undefined,
    scenicSpot: spotFilter !== 'all' ? spotFilter : undefined,
    groupType: groupTypeFilter !== 'all' ? groupTypeFilter : undefined,
  });
  
  // 获取热度排行榜
  const { data: hotRanking } = trpc.template.ranking.useQuery({
    type: 'hot',
    limit: 10,
  });
  
  // 获取潜力排行榜
  const { data: potentialRanking } = trpc.template.ranking.useQuery({
    type: 'potential',
    limit: 10,
  });
  
  // KPI 卡片数据
  const kpiCards = [
    {
      title: '总曝光数',
      value: statsData?.totalViews || 0,
      icon: Eye,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: '总点击数',
      value: statsData?.totalSelects || 0,
      icon: MousePointer,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      title: '总购买数',
      value: statsData?.totalPurchases || 0,
      icon: ShoppingCart,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      title: '转化率',
      value: `${statsData?.conversionRate || 0}%`,
      icon: TrendingUp,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
  ];
  
  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toLocaleString();
  };
  
  // 计算转化率
  const calcConversionRate = (selects: number, views: number) => {
    if (views === 0) return '0%';
    return ((selects / views) * 100).toFixed(1) + '%';
  };
  
  // 获取人群类型显示名称
  const getGroupTypeDisplayName = (code: string) => {
    const gt = groupTypes.find(g => g.code === code);
    return gt?.displayName || code;
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">模板数据统计</h1>
            <p className="text-sm text-gray-500">查看模板的曝光、点击、购买数据和排行榜</p>
          </div>
        </div>
        
        {/* 筛选条件 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              数据筛选
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">城市：</span>
                <Select value={cityFilter} onValueChange={(v) => {
                  setCityFilter(v);
                  setSpotFilter('all'); // 重置景点筛选
                }}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="全部城市" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部城市</SelectItem>
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.name}>{city.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">景点：</span>
                <Select value={spotFilter} onValueChange={setSpotFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部景点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部景点</SelectItem>
                    {filteredSpots.map(spot => (
                      <SelectItem key={spot.id} value={spot.name}>{spot.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">人群：</span>
                <Select value={groupTypeFilter} onValueChange={setGroupTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部人群" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部人群</SelectItem>
                    {groupTypes.map(gt => (
                      <SelectItem key={gt.code} value={gt.code}>{gt.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* KPI 卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{kpi.title}</p>
                    <p className="text-2xl font-bold mt-1">
                      {typeof kpi.value === 'number' ? formatNumber(kpi.value) : kpi.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${kpi.bgColor}`}>
                    <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* 排行榜 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 热度排行榜 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                热度排行榜
              </CardTitle>
              <CardDescription>按曝光数排序的 TOP 10 模板</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">排名</TableHead>
                    <TableHead>模板</TableHead>
                    <TableHead className="text-right">曝光</TableHead>
                    <TableHead className="text-right">点击</TableHead>
                    <TableHead className="text-right">转化率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotRanking?.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {index < 3 ? (
                          <Badge variant={index === 0 ? 'default' : 'secondary'} className={
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                          }>
                            {index + 1}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">{index + 1}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                          <div>
                            <p className="font-medium text-sm">{item.name || item.templateId}</p>
                            <p className="text-xs text-gray-500">{item.city} · {item.scenicSpot}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(item.viewCount)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.selectCount)}</TableCell>
                      <TableCell className="text-right">
                        {calcConversionRate(item.selectCount, item.viewCount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!hotRanking || hotRanking.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* 潜力排行榜 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                潜力排行榜
              </CardTitle>
              <CardDescription>按转化率排序的 TOP 10 模板</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">排名</TableHead>
                    <TableHead>模板</TableHead>
                    <TableHead className="text-right">曝光</TableHead>
                    <TableHead className="text-right">点击</TableHead>
                    <TableHead className="text-right">转化率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {potentialRanking?.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {index < 3 ? (
                          <Badge variant={index === 0 ? 'default' : 'secondary'} className={
                            index === 0 ? 'bg-purple-500' : 
                            index === 1 ? 'bg-purple-400' : 'bg-purple-300'
                          }>
                            {index + 1}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">{index + 1}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                          <div>
                            <p className="font-medium text-sm">{item.name || item.templateId}</p>
                            <p className="text-xs text-gray-500">{item.city} · {item.scenicSpot}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(item.viewCount)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.selectCount)}</TableCell>
                      <TableCell className="text-right">
                        {calcConversionRate(item.selectCount, item.viewCount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!potentialRanking || potentialRanking.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        
        {/* 模板详细数据表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              模板数据明细
            </CardTitle>
            <CardDescription>
              共 {statsData?.templates?.length || 0} 个模板
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模板</TableHead>
                  <TableHead>城市</TableHead>
                  <TableHead>景点</TableHead>
                  <TableHead>人群类型</TableHead>
                  <TableHead className="text-right">曝光数</TableHead>
                  <TableHead className="text-right">点击数</TableHead>
                  <TableHead className="text-right">购买数</TableHead>
                  <TableHead className="text-right">点击率</TableHead>
                  <TableHead className="text-right">购买率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statsData?.templates?.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img 
                          src={template.imageUrl} 
                          alt={template.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                        <div>
                          <p className="font-medium text-sm">{template.name || template.templateId}</p>
                          <p className="text-xs text-gray-400">{template.templateId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{template.city}</TableCell>
                    <TableCell>{template.scenicSpot}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getGroupTypeDisplayName(template.groupType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(template.viewCount)}</TableCell>
                    <TableCell className="text-right">{formatNumber(template.selectCount)}</TableCell>
                    <TableCell className="text-right">{formatNumber(template.purchaseCount)}</TableCell>
                    <TableCell className="text-right">
                      {calcConversionRate(template.selectCount, template.viewCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {calcConversionRate(template.purchaseCount, template.viewCount)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!statsData?.templates || statsData.templates.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
