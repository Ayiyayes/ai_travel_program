import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/_core/hooks/useAdminAuth';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Upload,
  Image,
  Settings2,
  LayoutGrid,
  LayoutList,
  ChevronRight,
  ChevronLeft,
  Eye,
  Users,
  ShoppingCart,
  X,
  GripVertical
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// 模板类型定义
interface Template {
  id: number;
  templateId: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  city: string;
  scenicSpot: string;
  groupType: string;
  photoType: 'single' | 'group';
  faceType: 'wide' | 'narrow' | 'both';
  price: number;
  isFree: boolean;
  prompt?: string | null;
  sortOrder: number;
  status: 'active' | 'inactive';
  viewCount: number;
  selectCount: number;
  purchaseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function TemplatesPage() {
  const { user } = useAdminAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterSpot, setFilterSpot] = useState<string>('all');
  const [filterGroupType, setFilterGroupType] = useState<string>('all');
  const [filterFaceType, setFilterFaceType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 支持脸型选择的人群类型代码
  const FACE_TYPE_SELECTABLE_GROUPS = ['girl_young', 'woman_mature', 'man_young', 'woman_elder', 'man_elder'];
  // 脸型筛选是否激活（仅当选择了支持脸型的人群类型时）
  const isFaceTypeFilterEnabled = filterGroupType !== 'all' && FACE_TYPE_SELECTABLE_GROUPS.includes(filterGroupType);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  // 视图模式：card 卡片视图，table 表格视图（默认表格视图）
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  
  // 右侧预览面板
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // 批量操作状态
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [batchEditData, setBatchEditData] = useState({
    city: '',
    scenicSpot: '',
    groupType: '',
    faceType: '',
    price: '',
    status: '',
  });

  // 表单状态
  const [formData, setFormData] = useState({
    templateId: '',
    name: '',
    imageUrl: '',
    thumbnailUrl: '',
    city: '',
    scenicSpot: '',
    groupType: '',
    photoType: 'single' as 'single' | 'group',
    faceType: 'both' as 'wide' | 'narrow' | 'both',
    price: 0,
    isFree: false,
    prompt: '',
    sortOrder: 0,
  });

  // 获取模板列表
  const { data: templates, isLoading, refetch } = trpc.admin.allTemplates.useQuery({
    city: filterCity === 'all' ? undefined : filterCity,
    status: filterStatus === 'all' ? undefined : filterStatus as any,
  });

  // 获取城市景点列表（从系统配置读取）
  const { data: citySpots } = trpc.admin.citySpots.useQuery();
  
  // 获取人群类型列表（从系统配置读取）
  const { data: groupTypes } = trpc.admin.groupTypes.useQuery();
  
  // 从城市景点数据中提取城市列表（包含"全国通用"）
  const cities = useMemo(() => {
    if (!citySpots) return ['全国通用'];
    const cityList = Array.from(new Set(citySpots.map((cs: any) => cs.city)));
    // 确保"全国通用"在列表中
    if (!cityList.includes('全国通用')) {
      return ['全国通用', ...cityList];
    }
    return cityList;
  }, [citySpots]);

  // 根据选中城市过滤景点
  const spots = useMemo(() => {
    if (!citySpots) return [];
    if (filterCity === 'all' || filterCity === '全国通用') return citySpots.flatMap((cs: any) => cs.spots);
    const cityData = citySpots.find((cs: any) => cs.city === filterCity);
    return cityData?.spots || [];
  }, [citySpots, filterCity]);

  // 根据筛选条件过滤模板
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    return templates.filter(t => {
      const matchSearch = !searchTerm ||
        t.name.includes(searchTerm) ||
        t.templateId.includes(searchTerm);
      const matchSpot = filterSpot === 'all' || t.scenicSpot === filterSpot;
      const matchGroupType = filterGroupType === 'all' || t.groupType === filterGroupType;
      // 脸型筛选：仅当激活时才进行筛选
      const matchFaceType = !isFaceTypeFilterEnabled || filterFaceType === 'all' || t.faceType === filterFaceType;
      return matchSearch && matchSpot && matchGroupType && matchFaceType;
    });
  }, [templates, searchTerm, filterSpot, filterGroupType, filterFaceType, isFaceTypeFilterEnabled]);

  // 是否可以拖拽排序（必须同时选择城市、景点、人群类型）
  const canDragSort = filterCity !== 'all' && filterSpot !== 'all' && filterGroupType !== 'all';

  // 拖拽排序传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 创建模板
  const createMutation = trpc.template.create.useMutation({
    onSuccess: () => {
      toast.success('模板创建成功');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '创建失败');
    },
  });

  // 更新模板
  const updateMutation = trpc.template.update.useMutation({
    onSuccess: () => {
      toast.success('模板更新成功');
      setEditingTemplate(null);
      resetForm();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '更新失败');
    },
  });

  // 删除模板
  const deleteMutation = trpc.template.delete.useMutation({
    onSuccess: () => {
      toast.success('模板删除成功');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '删除失败');
    },
  });

  // 切换模板状态
  const toggleStatusMutation = trpc.template.toggleStatus.useMutation({
    onSuccess: (data) => {
      toast.success(data.status === 'active' ? '模板已上架' : '模板已下架');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '状态切换失败');
    },
  });

  // 切换模板状态
  const handleToggleStatus = (id: number) => {
    toggleStatusMutation.mutate({ id });
  };

  // 批量更新模板
  const batchUpdateMutation = trpc.template.batchUpdate.useMutation({
    onSuccess: (data) => {
      toast.success(`成功更新 ${data.count} 个模板`);
      setIsBatchEditOpen(false);
      setSelectedIds([]);
      setBatchEditData({ city: '', scenicSpot: '', groupType: '', faceType: '', price: '', status: '' });
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '批量更新失败');
    },
  });

  // 批量删除模板
  const batchDeleteMutation = trpc.template.batchDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`成功删除 ${data.count} 个模板`);
      setIsBatchDeleteOpen(false);
      setSelectedIds([]);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '批量删除失败');
    },
  });

  // 更新模板排序
  const updateSortOrderMutation = trpc.template.updateSortOrders.useMutation({
    onSuccess: () => {
      toast.success('排序已更新');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || '更新排序失败');
    },
  });

  // 拖拽排序结束处理
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredTemplates.findIndex(t => t.id === active.id);
    const newIndex = filteredTemplates.findIndex(t => t.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    // 计算新的排序顺序
    const reorderedTemplates = arrayMove(filteredTemplates, oldIndex, newIndex);
    const updates = reorderedTemplates.map((t, index) => ({
      id: t.id,
      sortOrder: index + 1,
    }));

    updateSortOrderMutation.mutate(updates);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      templateId: '',
      name: '',
      imageUrl: '',
      thumbnailUrl: '',
      city: '',
      scenicSpot: '',
      groupType: '',
      photoType: 'single',
      faceType: 'both',
      price: 0,
      isFree: false,
      prompt: '',
      sortOrder: 0,
    });
  };

  // 打开编辑对话框
  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      templateId: template.templateId,
      name: template.name,
      imageUrl: template.imageUrl,
      thumbnailUrl: template.thumbnailUrl || '',
      city: template.city,
      scenicSpot: template.scenicSpot,
      groupType: template.groupType,
      photoType: template.photoType,
      faceType: template.faceType,
      price: template.price,
      isFree: template.isFree,
      prompt: template.prompt || '',
      sortOrder: template.sortOrder,
    });
  };

  // 提交表单
  const handleSubmit = () => {
    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  // 删除模板
  const handleDelete = (id: number) => {
    if (confirm('确定要删除这个模板吗？')) {
      deleteMutation.mutate({ id });
    }
  };

  // 记录上次点击的模板ID，用于Shift范围选择
  const [lastClickedId, setLastClickedId] = useState<number | null>(null);

  // 选择模板预览（单击行时调用）
  const handleSelectTemplate = (template: Template, event?: React.MouseEvent) => {
    setSelectedTemplate(template);
    if (!isPanelOpen) {
      setIsPanelOpen(true);
    }
  };

  // 行点击处理：实现单击/Shift/Ctrl选择逻辑
  const handleRowClick = (template: Template, event: React.MouseEvent) => {
    const id = template.id;
    
    // Ctrl/Cmd + 点击：多选/取消选中当前行
    if (event.ctrlKey || event.metaKey) {
      setSelectedIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(i => i !== id);
        } else {
          return [...prev, id];
        }
      });
      setLastClickedId(id);
    }
    // Shift + 点击：范围选择
    else if (event.shiftKey && lastClickedId !== null) {
      const currentIndex = filteredTemplates.findIndex(t => t.id === id);
      const lastIndex = filteredTemplates.findIndex(t => t.id === lastClickedId);
      
      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const rangeIds = filteredTemplates.slice(start, end + 1).map(t => t.id);
        
        // 合并已选中的和范围内的
        setSelectedIds(prev => {
          const newSet = new Set([...prev, ...rangeIds]);
          return Array.from(newSet);
        });
      }
    }
    // 普通点击：选中当前行，取消其他行
    else {
      setSelectedIds([id]);
      setLastClickedId(id);
    }
    
    // 同时更新预览面板
    setSelectedTemplate(template);
    if (!isPanelOpen) {
      setIsPanelOpen(true);
    }
  };

  // 批量选择处理（表头复选框）
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTemplates?.map(t => t.id) || []);
    } else {
      setSelectedIds([]);
    }
  };

  // 复选框点击处理（不影响其他选中状态）
  const handleCheckboxClick = (id: number, checked: boolean, event: React.MouseEvent) => {
    event.stopPropagation();
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
    setLastClickedId(id);
  };

  // 批量编辑提交
  const handleBatchEdit = () => {
    const data: any = {};
    if (batchEditData.city && batchEditData.city !== '__none__') data.city = batchEditData.city;
    if (batchEditData.scenicSpot && batchEditData.scenicSpot !== '__none__') data.scenicSpot = batchEditData.scenicSpot;
    if (batchEditData.groupType && batchEditData.groupType !== '__none__') data.groupType = batchEditData.groupType;
    if (batchEditData.faceType && batchEditData.faceType !== '__none__') data.faceType = batchEditData.faceType;
    if (batchEditData.price) data.price = parseInt(batchEditData.price);
    if (batchEditData.status && batchEditData.status !== '__none__') data.status = batchEditData.status;
    
    if (Object.keys(data).length === 0) {
      toast.error('请至少选择一个要修改的字段');
      return;
    }
    
    batchUpdateMutation.mutate({ ids: selectedIds, data });
  };

  // 批量删除提交
  const handleBatchDelete = () => {
    batchDeleteMutation.mutate({ ids: selectedIds });
  };

  // 批量编辑弹窗中的城市-景点联动
  const batchEditSpots = useMemo(() => {
    if (!citySpots || !batchEditData.city) return [];
    const cityData = citySpots.find((cs: any) => cs.city === batchEditData.city);
    return cityData?.spots || [];
  }, [citySpots, batchEditData.city]);

  // 检查管理员权限
  if (user?.role !== 'admin') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-medium mb-2">无权访问</h2>
            <p className="text-muted-foreground">您没有管理员权限</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* 主内容区 */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300",
          isPanelOpen && viewMode === 'table' ? "mr-0" : ""
        )}>
          {/* 页面标题和操作栏 */}
          <div className="flex-shrink-0 p-3 border-b bg-background">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-xl font-bold">模板管理</h1>
                <p className="text-sm text-muted-foreground">管理换脸模板</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => navigate('/admin/templates/config')}>
                  <Plus className="w-4 h-4 mr-2" />
                  新建模板
                </Button>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild className="hidden">
                    <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      新建模板
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>新建模板</DialogTitle>
                    </DialogHeader>
                    <TemplateForm 
                      formData={formData} 
                      setFormData={setFormData}
                      onSubmit={handleSubmit}
                      isLoading={createMutation.isPending}
                      citySpots={citySpots}
                      groupTypes={groupTypes}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* 筛选和搜索 */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px] max-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索模板名称或ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={filterCity} onValueChange={(v) => { 
                setFilterCity(v); 
                // 切换城市时，自动选择该城市的第一个景点
                if (v === 'all') {
                  setFilterSpot('all');
                } else {
                  const cityData = citySpots?.find((cs: any) => cs.city === v);
                  const firstSpot = cityData?.spots?.[0]?.name;
                  setFilterSpot(firstSpot || 'all');
                }
              }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="选择城市" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部城市</SelectItem>
                  {cities?.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSpot} onValueChange={(v) => {
                setFilterSpot(v);
                // 当选择景点时，自动联动选中对应的城市
                if (v !== 'all' && citySpots) {
                  const cityData = citySpots.find((cs: any) => 
                    cs.spots?.some((s: any) => s.name === v)
                  );
                  if (cityData && filterCity !== cityData.city) {
                    setFilterCity(cityData.city);
                  }
                }
              }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="选择景点" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部景点</SelectItem>
                  {spots?.map((spot: any) => (
                    <SelectItem key={spot.id || spot.name} value={spot.name}>{spot.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterGroupType} onValueChange={(v) => {
                setFilterGroupType(v);
                // 切换人群类型时，重置脸型筛选
                setFilterFaceType('all');
              }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="人群类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部人群</SelectItem>
                  {groupTypes?.filter((g: any) => g.isActive).map((g: any) => (
                    <SelectItem key={g.code} value={g.code}>{g.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterFaceType}
                onValueChange={setFilterFaceType}
                disabled={!isFaceTypeFilterEnabled}
              >
                <SelectTrigger className={`w-[100px] ${!isFaceTypeFilterEnabled ? 'opacity-50' : ''}`}>
                  <SelectValue placeholder="脸型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部脸型</SelectItem>
                  <SelectItem value="narrow">窄脸</SelectItem>
                  <SelectItem value="wide">宽脸</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">已启用</SelectItem>
                  <SelectItem value="inactive">已禁用</SelectItem>
                </SelectContent>
              </Select>
              
              {/* 视图切换 */}
              <div className="flex items-center gap-1 ml-auto border rounded-md p-1">
                <Button
                  variant={viewMode === 'card' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className="h-8 w-8 p-0"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-8 w-8 p-0"
                >
                  <LayoutList className="w-4 h-4" />
                </Button>
              </div>
              
              {/* 预览面板切换（仅表格视图） */}
              {viewMode === 'table' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  className="gap-1"
                >
                  {isPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  预览
                </Button>
              )}
            </div>

            {/* 批量操作栏 - 只在选中2行及以上时才显示整个操作栏 */}
            {selectedIds.length >= 2 && (
              <div className="flex items-center gap-4 mt-4 p-3 bg-muted/50 rounded-lg border">
                <span className="text-sm font-medium">已选择 {selectedIds.length} 项</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsBatchEditOpen(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    批量编辑
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setIsBatchDeleteOpen(true)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    批量删除
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                    <X className="w-4 h-4 mr-1" />
                    取消选择
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 模板列表 */}
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              viewMode === 'card' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              )
            ) : filteredTemplates && filteredTemplates.length > 0 ? (
              viewMode === 'card' ? (
                // 卡片视图
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredTemplates.map(template => (
                    <Card 
                      key={template.id} 
                      className={cn(
                        "overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                        selectedTemplate?.id === template.id && "ring-2 ring-primary"
                      )}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="aspect-[3/4] relative">
                        <img
                          src={template.thumbnailUrl || template.imageUrl}
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                        <div className={cn(
                          "absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs",
                          template.status === 'active' 
                            ? "bg-green-500 text-white" 
                            : "bg-gray-500 text-white"
                        )}>
                          {template.status === 'active' ? '启用' : '禁用'}
                        </div>
                        {template.isFree && (
                          <div className="absolute top-2 left-2 bg-[#e89a8d] text-white px-2 py-0.5 rounded-full text-xs">
                            免费
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium text-sm truncate">{template.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {template.city} · {template.scenicSpot}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm text-[#e89a8d]">
                            {template.isFree ? '免费' : `${template.price}积分`}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); handleToggleStatus(template.id); }}
                              title={template.status === 'active' ? '点击下架' : '点击上架'}
                            >
                              <Switch 
                                checked={template.status === 'active'} 
                                className="pointer-events-none scale-75"
                              />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); handleEdit(template); }}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                // 表格视图
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="rounded-md border bg-card">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          {canDragSort && <TableHead className="w-10"></TableHead>}
                          <TableHead className="w-12">
                            <Checkbox 
                              checked={filteredTemplates?.length > 0 && selectedIds.length === filteredTemplates?.length}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="w-16">排序</TableHead>
                          <TableHead className="w-20">缩略图</TableHead>
                          <TableHead>模板ID</TableHead>
                          <TableHead>城市</TableHead>
                          <TableHead>景点</TableHead>
                          <TableHead>人群类型</TableHead>
                          <TableHead>脸型</TableHead>
                          <TableHead>照片类型</TableHead>
                          <TableHead>积分</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <SortableContext
                        items={filteredTemplates.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <TableBody>
                          {filteredTemplates.map(template => (
                            <SortableTemplateRow
                              key={template.id}
                              template={template}
                              canDragSort={canDragSort}
                              selectedTemplate={selectedTemplate}
                              selectedIds={selectedIds}
                              handleRowClick={handleRowClick}
                              handleCheckboxClick={handleCheckboxClick}
                              handleToggleStatus={handleToggleStatus}
                              setEditingTemplate={setEditingTemplate}
                              handleDelete={handleDelete}
                              groupTypes={groupTypes}
                            />
                          ))}
                        </TableBody>
                      </SortableContext>
                    </Table>
                  </div>
                </DndContext>
              )
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Image className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">暂无模板</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 右侧预览面板 */}
        {viewMode === 'table' && isPanelOpen && (
          <aside className="w-80 flex-shrink-0 border-l bg-card overflow-y-auto">
            <TemplatePreviewPanel 
              template={selectedTemplate}
              onClose={() => setIsPanelOpen(false)}
              onEdit={handleEdit}
              groupTypes={groupTypes}
            />
          </aside>
        )}

        {/* 编辑对话框 */}
        <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑模板</DialogTitle>
            </DialogHeader>
            <TemplateForm 
              formData={formData} 
              setFormData={setFormData}
              onSubmit={handleSubmit}
              isLoading={updateMutation.isPending}
              citySpots={citySpots}
              groupTypes={groupTypes}
            />
          </DialogContent>
        </Dialog>

        {/* 批量编辑对话框 */}
        <Dialog open={isBatchEditOpen} onOpenChange={setIsBatchEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>批量编辑 ({selectedIds.length} 个模板)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">只修改有值的字段，空白字段将保持不变</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>城市</Label>
                  <Select 
                    value={batchEditData.city} 
                    onValueChange={(v) => {
                      const cityData = citySpots?.find((cs: any) => cs.city === v);
                      const firstSpot = cityData?.spots?.[0]?.name || '';
                      setBatchEditData({ ...batchEditData, city: v, scenicSpot: firstSpot });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="不修改" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不修改</SelectItem>
                      {cities.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>景点</Label>
                  <Select 
                    value={batchEditData.scenicSpot} 
                    onValueChange={(v) => setBatchEditData({ ...batchEditData, scenicSpot: v })}
                    disabled={!batchEditData.city}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="不修改" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不修改</SelectItem>
                      {batchEditSpots.map((spot: any) => (
                        <SelectItem key={spot.id || spot.name} value={spot.name}>{spot.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>人群类型</Label>
                  <Select 
                    value={batchEditData.groupType} 
                    onValueChange={(v) => setBatchEditData({ ...batchEditData, groupType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="不修改" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不修改</SelectItem>
                      {groupTypes?.filter((g: any) => g.isActive).map((g: any) => (
                        <SelectItem key={g.code} value={g.code}>{g.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>脸型适配</Label>
                  <Select 
                    value={batchEditData.faceType} 
                    onValueChange={(v) => setBatchEditData({ ...batchEditData, faceType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="不修改" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不修改</SelectItem>
                      <SelectItem value="both">通用</SelectItem>
                      <SelectItem value="wide">宽脸</SelectItem>
                      <SelectItem value="narrow">窄脸</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>积分价格</Label>
                  <Input
                    type="number"
                    value={batchEditData.price}
                    onChange={(e) => setBatchEditData({ ...batchEditData, price: e.target.value })}
                    placeholder="不修改"
                  />
                </div>
                <div className="space-y-2">
                  <Label>状态</Label>
                  <Select 
                    value={batchEditData.status} 
                    onValueChange={(v) => setBatchEditData({ ...batchEditData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="不修改" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不修改</SelectItem>
                      <SelectItem value="active">启用</SelectItem>
                      <SelectItem value="inactive">禁用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsBatchEditOpen(false)}>取消</Button>
                <Button onClick={handleBatchEdit} disabled={batchUpdateMutation.isPending}>
                  {batchUpdateMutation.isPending ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 批量删除确认对话框 */}
        <Dialog open={isBatchDeleteOpen} onOpenChange={setIsBatchDeleteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                确定要删除选中的 <span className="font-bold text-foreground">{selectedIds.length}</span> 个模板吗？此操作不可恢复。
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsBatchDeleteOpen(false)}>取消</Button>
                <Button variant="destructive" onClick={handleBatchDelete} disabled={batchDeleteMutation.isPending}>
                  {batchDeleteMutation.isPending ? '删除中...' : '确认删除'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

// 可拖拽排序的表格行组件
function SortableTemplateRow({
  template,
  canDragSort,
  selectedTemplate,
  selectedIds,
  handleRowClick,
  handleCheckboxClick,
  handleToggleStatus,
  setEditingTemplate,
  handleDelete,
  groupTypes,
}: {
  template: Template;
  canDragSort: boolean;
  selectedTemplate: Template | null;
  selectedIds: number[];
  handleRowClick: (template: Template, event: React.MouseEvent) => void;
  handleCheckboxClick: (id: number, checked: boolean, event: React.MouseEvent) => void;
  handleToggleStatus: (id: number) => void;
  setEditingTemplate: (template: Template) => void;
  handleDelete: (id: number) => void;
  groupTypes?: any[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id, disabled: !canDragSort });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-pointer",
        selectedIds.includes(template.id) && "bg-primary/10",
        selectedTemplate?.id === template.id && "bg-muted"
      )}
      onClick={(e) => handleRowClick(template, e)}
    >
      {canDragSort && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
        </TableCell>
      )}
      <TableCell>
        <Checkbox
          checked={selectedIds.includes(template.id)}
          onCheckedChange={(checked) => {
            // 复选框点击不触发行点击事件
          }}
          onClick={(e: React.MouseEvent) => handleCheckboxClick(template.id, !selectedIds.includes(template.id), e)}
        />
      </TableCell>
      <TableCell className="text-center text-muted-foreground">
        {template.sortOrder || '-'}
      </TableCell>
      <TableCell>
        <div className="w-12 h-16 rounded overflow-hidden bg-muted">
          <img
            src={template.thumbnailUrl || template.imageUrl}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">
        {template.templateId}
      </TableCell>
      <TableCell>{template.city}</TableCell>
      <TableCell>{template.scenicSpot}</TableCell>
      <TableCell>
        {groupTypes?.find((g: any) => g.code === template.groupType)?.displayName || template.groupType}
      </TableCell>
      <TableCell>
        <span className={cn(
          "text-xs px-2 py-1 rounded",
          template.faceType === 'wide' && "bg-blue-100 text-blue-700",
          template.faceType === 'narrow' && "bg-purple-100 text-purple-700",
          template.faceType === 'both' && "bg-gray-100 text-gray-700"
        )}>
          {template.faceType === 'wide' ? '宽脸' : template.faceType === 'narrow' ? '窄脸' : '通用'}
        </span>
      </TableCell>
      <TableCell>
        {template.photoType === 'single' ? '单人' : '双人'}
      </TableCell>
      <TableCell>
        {template.isFree ? (
          <span className="text-[#e89a8d]">免费</span>
        ) : (
          <span>{template.price}积分</span>
        )}
      </TableCell>
      <TableCell>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-xs",
          template.status === 'active'
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-700"
        )}>
          {template.status === 'active' ? '启用' : '禁用'}
        </span>
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleToggleStatus(template.id)}
          >
            <Switch
              checked={template.status === 'active'}
              className="pointer-events-none scale-75"
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setEditingTemplate(template)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleDelete(template.id)}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// 右侧预览面板组件
function TemplatePreviewPanel({ 
  template, 
  onClose,
  onEdit,
  groupTypes
}: { 
  template: Template | null;
  onClose: () => void;
  onEdit: (template: Template) => void;
  groupTypes?: any[];
}) {
  if (!template) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center">
        <div>
          <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>选择一个模板以预览</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium truncate flex-1" title={template.name}>
          {template.name}
        </h3>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* 图片预览 */}
      <div className="p-4">
        <div className="aspect-[3/4] relative bg-muted rounded-lg overflow-hidden border">
          <img
            src={template.imageUrl}
            alt={template.name}
            className="w-full h-full object-contain"
          />
          <div className={cn(
            "absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs",
            template.status === 'active' 
              ? "bg-green-500 text-white" 
              : "bg-gray-500 text-white"
          )}>
            {template.status === 'active' ? '启用' : '禁用'}
          </div>
        </div>
      </div>

      {/* 统计数据 */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Eye className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{template.viewCount || 0}</div>
            <div className="text-xs text-muted-foreground">浏览</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Users className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{template.selectCount || 0}</div>
            <div className="text-xs text-muted-foreground">选择</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <ShoppingCart className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{template.purchaseCount || 0}</div>
            <div className="text-xs text-muted-foreground">购买</div>
          </div>
        </div>
      </div>

      {/* 详细信息 */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium">模板信息</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">模板ID</span>
              <span className="font-mono text-xs truncate max-w-[150px]" title={template.templateId}>
                {template.templateId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">城市</span>
              <span>{template.city}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">景点</span>
              <span>{template.scenicSpot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">人群类型</span>
              <span>{groupTypes?.find((g: any) => g.code === template.groupType)?.displayName || template.groupType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">照片类型</span>
              <span>{template.photoType === 'single' ? '单人照' : '双人照'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">脸型适配</span>
              <span>
                {template.faceType === 'both' ? '通用' : 
                 template.faceType === 'wide' ? '宽脸' : '窄脸'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">积分</span>
              <span className="text-[#e89a8d]">
                {template.isFree ? '免费' : `${template.price}积分`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">排序权重</span>
              <span>{template.sortOrder}</span>
            </div>
            {template.prompt && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground block mb-1">提示词</span>
                <p className="text-xs bg-muted p-2 rounded">{template.prompt}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 操作按钮 */}
      <div className="p-4 border-t">
        <Button className="w-full" onClick={() => onEdit(template)}>
          <Edit className="w-4 h-4 mr-2" />
          编辑模板
        </Button>
      </div>
    </div>
  );
}

// 模板表单组件
function TemplateForm({ 
  formData, 
  setFormData, 
  onSubmit,
  isLoading,
  citySpots,
  groupTypes
}: { 
  formData: any; 
  setFormData: (data: any) => void;
  onSubmit: () => void;
  isLoading: boolean;
  citySpots?: any[];
  groupTypes?: any[];
}) {
  // 从城市景点数据中提取城市列表
  const cities = useMemo(() => {
    if (!citySpots) return [];
    return Array.from(new Set(citySpots.map((cs: any) => cs.city)));
  }, [citySpots]);
  
  // 根据选中城市过滤景点
  const spots = useMemo(() => {
    if (!citySpots) return [];
    const cityData = citySpots.find((cs: any) => cs.city === formData.city);
    return cityData?.spots || [];
  }, [citySpots, formData.city]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>模板ID</Label>
        <Input
          value={formData.templateId}
          readOnly
          className="bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Label>图片URL</Label>
        <Input
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>城市</Label>
          <Select 
            value={formData.city} 
            onValueChange={(v) => {
              // 切换城市时，自动选择该城市的第一个景点
              const cityData = citySpots?.find((cs: any) => cs.city === v);
              const firstSpot = cityData?.spots?.[0]?.name || '';
              setFormData({ ...formData, city: v, scenicSpot: firstSpot });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择城市" />
            </SelectTrigger>
            <SelectContent>
              {cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>景区</Label>
          <Select 
            value={formData.scenicSpot} 
            onValueChange={(v) => setFormData({ ...formData, scenicSpot: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择景区" />
            </SelectTrigger>
            <SelectContent>
              {spots.map((spot: any) => (
                <SelectItem key={spot.id || spot.name} value={spot.name}>{spot.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>人群类型</Label>
          <Select 
            value={formData.groupType} 
            onValueChange={(v) => setFormData({ ...formData, groupType: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择人群类型" />
            </SelectTrigger>
            <SelectContent>
              {groupTypes?.filter((g: any) => g.isActive).map((g: any) => (
                <SelectItem key={g.code} value={g.code}>{g.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>脸型适配</Label>
          <Select 
            value={formData.faceType} 
            onValueChange={(v) => setFormData({ ...formData, faceType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">通用</SelectItem>
              <SelectItem value="wide">宽脸</SelectItem>
              <SelectItem value="narrow">窄脸</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>积分价格</Label>
          <Input
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>排序权重</Label>
          <Input
            type="number"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={formData.isFree}
          onCheckedChange={(checked) => setFormData({ ...formData, isFree: checked })}
        />
        <Label>免费模板</Label>
      </div>

      <div className="space-y-2">
        <Label>提示词（可选）</Label>
        <Input
          value={formData.prompt}
          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
          placeholder="AI 生成提示词"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" type="button">取消</Button>
        <Button onClick={onSubmit} disabled={isLoading}>
          {isLoading ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  );
}
