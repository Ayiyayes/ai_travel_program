import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/_core/hooks/useAdminAuth';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FolderPlus, 
  Wand2, 
  Save,
  Trash2,
  Image as ImageIcon,
  Settings,
  Package,
  Eye,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  FolderOpen,
  Database,
  X,
  Users,
  ShoppingCart,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import MaskRegionConfig from '@/components/MaskRegionConfig';

// 人群类型类型定义
interface GroupType {
  id: number;
  code: string;
  displayName: string;
  photoType: 'single' | 'group';
  isActive: boolean;
  sortOrder: number;
}

// 价格选项
const PRICE_OPTIONS = [0, 5, 8, 10, 12, 15, 20];

// 全局设置类型
interface GlobalSettings {
  defaultCity: string;
  defaultSpot: string;
  defaultGroupType: string;
  defaultFaceType: 'wide' | 'narrow';
  defaultPrice: number;
}

// 图片项类型
interface ImageItem {
  id: string;
  file: File | null;
  previewUrl: string; // 本地 blob URL 或 S3 URL
  thumbnailUrl?: string;
  webpUrl?: string;
  thumbnailWebpUrl?: string;
  fileName: string;
  city: string;
  spot: string;
  groupType: string;
  faceType: 'wide' | 'narrow';
  price: number;
  templateId: string;
  templateGroupId: string; // 模板配对ID，用于宽脸/窄脸配对关联
  prompt: string;
  selected: boolean;
  order: number;
  // 缓存相关
  cacheId?: number;
  isCached?: boolean;
  // S3 存储相关
  s3Key?: string;
  s3Url?: string;
  isUploading?: boolean;
  // 遮盖功能相关
  hasMaskRegions?: boolean;
  maskRegions?: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
  }>;
  maskedImageUrl?: string;
  regionCacheUrl?: string;
}

// 批次类型
interface ImageBatch {
  id: string;
  name: string;
  images: ImageItem[];
  isCollapsed: boolean;
  isPairedBatch?: boolean; // 是否为配对批次（自动创建宽窄脸配对）
  pairGroupId?: string; // 配对批次的 templateGroupId
  commonSettings: {
    city: string; // 逗号分隔的城市列表
    spot: string; // 逗号分隔的景点列表
    groupType: string;
    faceType: 'wide' | 'narrow';
    price: number;
    hasMaskRegions?: boolean; // 是否需要遮盖
  };
}

/**
 * 人群类型脸型配置映射表
 * - 'selectable': 可选择宽脸/窄脸（少女、熟女、奶奶、少男、大叔）- 需要配对
 * - 'fixed-narrow': 固定为窄脸（幼女、幼男、所有合照类型）- 无需配对
 */
const GROUP_TYPE_FACE_CONFIG: Record<string, 'selectable' | 'fixed-narrow'> = {
  // 需要区分脸型的5种（可选择"宽脸"和"窄脸"，需要宽窄脸配对）
  'girl_young': 'selectable',
  'woman_mature': 'selectable',
  'woman_elder': 'selectable',
  'man_young': 'selectable',
  'man_elder': 'selectable',
  // 固定为窄脸的（幼女、幼男、所有合照类型）- 无需配对
  'girl_child': 'fixed-narrow',
  'boy_child': 'fixed-narrow',
  'couple_love': 'fixed-narrow',
  'friends_girls': 'fixed-narrow',
  'friends_boys': 'fixed-narrow',
  'friends_mixed': 'fixed-narrow',
  'mom_son_child': 'fixed-narrow',
  'mom_son_adult': 'fixed-narrow',
  'mom_daughter_child': 'fixed-narrow',
  'mom_daughter_adult': 'fixed-narrow',
  'dad_son_child': 'fixed-narrow',
  'dad_son_adult': 'fixed-narrow',
  'dad_daughter_child': 'fixed-narrow',
  'dad_daughter_adult': 'fixed-narrow',
};

/**
 * 人群类型中文名到代码的映射
 * 支持文件夹使用中文名命名
 */
const GROUP_TYPE_CHINESE_TO_CODE: Record<string, string> = {
  // 单人类型
  '幼女': 'girl_child',
  '少女': 'girl_young',
  '熟女': 'woman_mature',
  '奶奶': 'woman_elder',
  '幼男': 'boy_child',
  '少男': 'man_young',
  '大叔': 'man_elder',
  // 合照类型
  '情侣': 'couple_love',
  '闺蜜': 'friends_girls',
  '兄弟': 'friends_boys',
  '异性伙伴': 'friends_mixed',
  '母子(少年)': 'mom_son_child',
  '母子(青年)': 'mom_son_adult',
  '母女(少年)': 'mom_daughter_child',
  '母女(青年)': 'mom_daughter_adult',
  '父子(少年)': 'dad_son_child',
  '父子(青年)': 'dad_son_adult',
  '父女(少年)': 'dad_daughter_child',
  '父女(青年)': 'dad_daughter_adult',
};

/**
 * 根据文件夹名称解析人群类型代码
 * 支持代码（如 girl_young）和中文名（如 少女）两种方式
 */
function parseGroupTypeFromFolderName(folderName: string): string | null {
  // 先检查是否是代码
  if (GROUP_TYPE_FACE_CONFIG[folderName]) {
    return folderName;
  }
  // 再检查是否是中文名
  if (GROUP_TYPE_CHINESE_TO_CODE[folderName]) {
    return GROUP_TYPE_CHINESE_TO_CODE[folderName];
  }
  return null;
}

/**
 * 生成模板配对ID（用于关联宽窄脸模板）
 * 格式：pair_<groupType>_<5位随机码>
 */
function generateTemplateGroupId(groupType: string): string {
  const randomCode = generateRandomCode();
  return `pair_${groupType}_${randomCode}`;
}

/**
 * 生成5位随机字母数字码
 */
function generateRandomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成唯一的模板ID
 * @param groupType 人群类型代码
 * @param faceType 脸型（只支持 wide 或 narrow）
 * @param existingIds 已存在的模板ID集合
 */
function generateUniqueTemplateId(
  groupType: string,
  faceType: 'wide' | 'narrow',
  existingIds: Set<string>
): string {
  const faceTypeConfig = GROUP_TYPE_FACE_CONFIG[groupType];
  // 确定脸型后缀（只有 _w 和 _n 两种）
  let faceTypeSuffix: string;
  if (faceTypeConfig === 'fixed-narrow') {
    faceTypeSuffix = '_n'; // 固定窄脸
  } else if (faceTypeConfig === 'selectable') {
    faceTypeSuffix = faceType === 'wide' ? '_w' : '_n';
  } else {
    faceTypeSuffix = '_n'; // 默认窄脸
  }

  // 生成唯一ID
  let templateId: string;
  let attempts = 0;
  do {
    const randomCode = generateRandomCode();
    templateId = `${groupType}_${randomCode}${faceTypeSuffix}`;
    attempts++;
    if (attempts > 1000) {
      throw new Error('无法生成唯一的模板ID，请检查数据库');
    }
  } while (existingIds.has(templateId));

  return templateId;
}

/**
 * 判断脸型是否需要配置选项
 * @param groupTypeCode - 人群类型代码（如 'girl_young', 'girl_child' 等）
 * @returns 'selectable' | 'fixed-narrow'
 *   - 'selectable': 可选择宽脸/窄脸（少女、熟女、奶奶、少男、大叔）
 *   - 'fixed-narrow': 固定为窄脸（幼女、幼男、所有合照类型以及其他未知类型）
 */
function getFaceTypeConfig(groupTypeCode: string): 'selectable' | 'fixed-narrow' {
  return GROUP_TYPE_FACE_CONFIG[groupTypeCode] ?? 'fixed-narrow';
}

// 多选城市组件
function MultiCitySelect({
  value,
  onChange,
  citySpots,
}: {
  value: string; // 逗号分隔的城市列表
  onChange: (value: string) => void;
  citySpots: { city: string; spots: string[] }[];
}) {
  const [open, setOpen] = useState(false);
  const selectedCities = value ? value.split(',').filter(Boolean) : [];
  const allCityOptions = ['全国通用', ...citySpots.map(c => c.city)];

  const toggleCity = (city: string) => {
    const newSelected = selectedCities.includes(city)
      ? selectedCities.filter(c => c !== city)
      : [...selectedCities, city];
    onChange(newSelected.join(','));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-xs"
        >
          <span className="truncate">
            {selectedCities.length === 0
              ? '选择城市'
              : selectedCities.length === 1
              ? selectedCities[0]
              : `${selectedCities.length}个城市`}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="搜索城市..." className="h-8" />
          <CommandEmpty>未找到城市</CommandEmpty>
          <CommandGroup className="max-h-[200px] overflow-auto">
            {allCityOptions.map((city) => (
              <CommandItem
                key={city}
                onSelect={() => toggleCity(city)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedCities.includes(city) ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {city}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// 多选景点组件
function MultiSpotSelect({
  value,
  onChange,
  cityValue,
  citySpots,
}: {
  value: string; // 逗号分隔的景点列表
  onChange: (value: string) => void;
  cityValue: string; // 逗号分隔的城市列表
  citySpots: { city: string; spots: string[] }[];
}) {
  const [open, setOpen] = useState(false);
  const selectedSpots = value ? value.split(',').filter(Boolean) : [];

  // 获取所选城市的所有景点
  const selectedCities = cityValue ? cityValue.split(',').filter(Boolean) : [];
  const availableSpots = selectedCities
    .filter(city => city !== '全国通用')
    .flatMap(city => {
      const cityData = citySpots.find(c => c.city === city);
      return cityData?.spots || [];
    })
    .filter((spot, index, arr) => arr.indexOf(spot) === index); // 去重

  const toggleSpot = (spot: string) => {
    const newSelected = selectedSpots.includes(spot)
      ? selectedSpots.filter(s => s !== spot)
      : [...selectedSpots, spot];
    onChange(newSelected.join(','));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-xs"
          disabled={availableSpots.length === 0}
        >
          <span className="truncate">
            {selectedSpots.length === 0
              ? '选择景点'
              : selectedSpots.length === 1
              ? selectedSpots[0]
              : `${selectedSpots.length}个景点`}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="搜索景点..." className="h-8" />
          <CommandEmpty>未找到景点</CommandEmpty>
          <CommandGroup className="max-h-[200px] overflow-auto">
            {availableSpots.map((spot) => (
              <CommandItem
                key={spot}
                onSelect={() => toggleSpot(spot)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedSpots.includes(spot) ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {spot}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// 可拖拽排序的表格行组件
interface SortableTableRowProps {
  img: ImageItem;
  batch: ImageBatch;
  selectedImage: ImageItem | null;
  handleSelectImage: (img: ImageItem) => void;
  updateImage: (batchId: string, imageId: string, updates: Partial<ImageItem>) => void;
  removeImage: (batchId: string, imageId: string) => void;
  citySpots: { city: string; spots: string[] }[];
  groupTypes: GroupType[];
}

function SortableTableRow({
  img,
  batch,
  selectedImage,
  handleSelectImage,
  updateImage,
  removeImage,
  citySpots,
  groupTypes,
}: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.id });

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
        selectedImage?.id === img.id && "bg-muted",
        isDragging && "bg-muted/50"
      )}
      onClick={() => handleSelectImage(img)}
    >
      <TableCell className="cursor-grab" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </TableCell>
      <TableCell
        className="cursor-pointer hover:bg-muted/50 font-medium"
        onClick={() => handleSelectImage(img)}
      >
        {img.order}
      </TableCell>
      <TableCell
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => handleSelectImage(img)}
      >
        <div className="w-12 h-16 rounded overflow-hidden cursor-pointer relative">
          {img.previewUrl ? (
            <img
              src={img.previewUrl}
              alt={img.fileName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          )}

        </div>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <MultiCitySelect
          value={img.city}
          onChange={(v) => updateImage(batch.id, img.id, { city: v })}
          citySpots={citySpots}
        />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <MultiSpotSelect
          value={img.spot}
          onChange={(v) => updateImage(batch.id, img.id, { spot: v })}
          cityValue={img.city}
          citySpots={citySpots}
        />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Select
          value={img.groupType}
          onValueChange={(v) => {
            // 当人群类型改变时，自动调整脸型为窄脸
            const updates: Partial<ImageItem> = { groupType: v };
            const faceTypeConfig = getFaceTypeConfig(v);

            if (faceTypeConfig === 'selectable') {
              // 可选择宽脸/窄脸：保持当前值，如果无效则设为窄脸
              if (img.faceType !== 'wide' && img.faceType !== 'narrow') {
                updates.faceType = 'narrow';
              }
            } else {
              // 固定为窄脸
              updates.faceType = 'narrow';
            }
            updateImage(batch.id, img.id, updates);
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupTypes.map(g => (
              <SelectItem key={g.code} value={g.code}>{g.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {/* 脸型选择与人群类型联动 */}
        {(() => {
          const faceTypeConfig = getFaceTypeConfig(img.groupType);

          if (faceTypeConfig === 'selectable') {
            // 少女、熟女、奶奶、少男、大叔：可选择宽脸和窄脸
            return (
              <Select
                value={img.faceType}
                onValueChange={(v) => updateImage(batch.id, img.id, { faceType: v as 'wide' | 'narrow' })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrow">窄脸</SelectItem>
                  <SelectItem value="wide">宽脸</SelectItem>
                </SelectContent>
              </Select>
            );
          } else {
            // 幼女、幼男、合照：固定为窄脸
            return (
              <div className="h-8 px-3 flex items-center text-sm text-muted-foreground bg-muted/50 rounded-md">
                窄脸 (固定)
              </div>
            );
          }
        })()}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Select
          value={img.price.toString()}
          onValueChange={(v) => updateImage(batch.id, img.id, { price: parseInt(v) })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRICE_OPTIONS.map(p => (
              <SelectItem key={p} value={p.toString()}>
                {p === 0 ? '免费' : `${p}积分`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Input
          value={img.templateId}
          onChange={(e) => updateImage(batch.id, img.id, { templateId: e.target.value })}
          placeholder="点击生成"
          className="h-8 text-xs font-mono"
        />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {/* 配对ID：只有 selectable 类型才需要配对 */}
        {getFaceTypeConfig(img.groupType) === 'selectable' ? (
          <Input
            value={img.templateGroupId || ''}
            onChange={(e) => updateImage(batch.id, img.id, { templateGroupId: e.target.value })}
            placeholder="配对ID"
            className="h-8 text-xs font-mono"
          />
        ) : (
          <div className="h-8 px-2 flex items-center text-xs text-muted-foreground">
            无需配对
          </div>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSelectImage(img)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeImage(batch.id, img.id)}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function TemplateConfigPage() {
  const { user } = useAdminAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // 从数据库获取人群类型
  const { data: groupTypesData } = trpc.admin.groupTypes.useQuery();
  const groupTypes = groupTypesData?.filter(g => g.isActive) || [];
  
  // 从数据库获取城市和景点
  const { data: citiesData } = trpc.admin.cities.useQuery();
  const { data: spotsData } = trpc.admin.spots.useQuery();
  const cities = citiesData || [];
  const spots = spotsData || [];
  
  // 构建城市景点映射
  const citySpots: { city: string; spots: string[] }[] = useMemo(() => {
    return cities.map(city => ({
      city: city.name,
      spots: spots.filter(s => s.cityId === city.id).map(s => s.name)
    }));
  }, [cities, spots]);
  
  // 批次状态
  const [batches, setBatches] = useState<ImageBatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [isClearing, setIsClearing] = useState(false); // 标志位：是否正在清除缓存

  // 右侧预览面板状态
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false); // 默认收缩状态
  
  // 遮盖配置弹窗状态
  const [showMaskConfigDialog, setShowMaskConfigDialog] = useState(false);
  const [maskConfigBatchId, setMaskConfigBatchId] = useState<string | null>(null);
  
  // 全局设置 - 从 localStorage 读取保存的设置
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(() => {
    const savedSettings = localStorage.getItem('templateConfigSettings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.error('读取保存的设置失败:', e);
      }
    }
    return {
      defaultCity: '长沙',
      defaultSpot: '橘子洲',
      defaultGroupType: 'girl_young',
      defaultFaceType: 'narrow' as 'wide' | 'narrow' | 'both',
      defaultPrice: 5,
    };
  });

  // 获取所有图片
  const allImages = batches.flatMap(b => b.images);

  // 缓存相关 mutations
  const saveCacheMutation = trpc.template.saveImageCache.useMutation({
    onError: (err) => {
      console.error('缓存保存失败:', err.message);
    },
  });

  // 上传图片到 S3
  const uploadCacheImageMutation = trpc.template.uploadCacheImage.useMutation();

  const { data: cachedImages, refetch: refetchCache } = trpc.template.getImageCache.useQuery(undefined, {
    enabled: true, // 页面加载时自动获取缓存
  });

  const utils = trpc.useUtils();
  
  const clearCacheMutation = trpc.template.clearImageCache.useMutation({
    onSuccess: async () => {
      toast.success('缓存已清除');

      // 使缓存失效并立即重新获取（此时服务器已清空，会返回空数组）
      await utils.template.getImageCache.invalidate();
      await refetchCache();

      // 5秒后恢复自动保存功能
      setTimeout(() => {
        setIsClearing(false);
      }, 5000);
    },
    onError: (error) => {
      toast.error('清除缓存失败: ' + error.message);
      // 发生错误时恢复状态
      setIsClearing(false);
    },
  });

  // 页面加载时自动从缓存恢复
  useEffect(() => {
    if (cachedImages && cachedImages.length > 0 && !cacheLoaded && batches.length === 0) {
      // 按批次ID分组缓存数据
      const batchGroups = new Map<string, any[]>();
      cachedImages.forEach((item: any) => {
        const batchId = item.batchId || 'default';
        if (!batchGroups.has(batchId)) {
          batchGroups.set(batchId, []);
        }
        batchGroups.get(batchId)!.push(item);
      });

      // 将分组数据转换为批次
      const restoredBatches: ImageBatch[] = [];
      batchGroups.forEach((items, batchId) => {
        const firstItem = items[0];
        const batchName = firstItem.batchName || `缓存恢复 (${items.length}张)`;
        
        restoredBatches.push({
          id: batchId === 'default' ? nanoid() : batchId,
          name: batchName,
          images: items.map((item: any, index: number) => ({
            id: nanoid(),
            file: null,
            previewUrl: item.previewUrl || '',
            fileName: item.fileName || '',
            city: item.city || globalSettings.defaultCity,
            spot: item.spot || globalSettings.defaultSpot,
            groupType: item.groupType || globalSettings.defaultGroupType,
            faceType: item.faceType || globalSettings.defaultFaceType,
            price: item.price || 0,
            templateId: item.templateId || '',
            templateGroupId: item.templateGroupId || '',
            prompt: item.prompt || '',
            selected: false,
            order: item.sortOrder || index + 1,
            cacheId: item.id,
            isCached: true,
            s3Key: item.s3Key || '',
            s3Url: item.previewUrl || '',
          })),
          isCollapsed: false,
          commonSettings: {
            city: firstItem.city || globalSettings.defaultCity,
            spot: firstItem.spot || globalSettings.defaultSpot,
            groupType: firstItem.groupType || globalSettings.defaultGroupType,
            faceType: firstItem.faceType || globalSettings.defaultFaceType,
            price: firstItem.price || globalSettings.defaultPrice,
          },
        });
      });

      setBatches(restoredBatches);
      setCacheLoaded(true);
    }
  }, [cachedImages, cacheLoaded, batches.length, globalSettings]);

  // 自动保存到缓存（当图片数据变化时）
  useEffect(() => {
    // 如果正在清除缓存，不执行自动保存
    if (isClearing) {
      return;
    }

    if (allImages.length > 0 && cacheLoaded) {
      // 构建缓存数据，包含批次信息
      const cacheData = batches.flatMap(batch => 
        batch.images.map(img => ({
          fileName: img.fileName,
          previewUrl: img.s3Url || img.previewUrl, // 优先使用 S3 URL
          s3Key: img.s3Key || '',
          city: img.city,
          spot: img.spot,
          groupType: img.groupType,
          faceType: img.faceType,
          price: img.price,
          templateId: img.templateId,
          prompt: img.prompt,
          order: img.order,
          batchName: batch.name,
          batchId: batch.id,
        }))
      );

      // 使用防抖自动保存
      const timer = setTimeout(() => {
        saveCacheMutation.mutate({ images: cacheData });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [batches, cacheLoaded, isClearing]);

  // 监听滚动实现吸顶效果（仅右侧主内容区域）
  useEffect(() => {
    const handleScroll = () => {
      if (toolbarRef.current) {
        const rect = toolbarRef.current.getBoundingClientRect();
        // 当工具栏顶部到达视口顶部时吸顶
        setIsSticky(rect.top <= 0);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 将文件转换为 Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:image/xxx;base64, 前缀
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // 添加批次
  const addBatch = useCallback(async (files: File[], batchName?: string) => {
    const toastId = toast.loading(`正在处理 ${files.length} 张图片...`);
    
    try {
      const newBatchId = nanoid();
      const finalBatchName = batchName || `批次 ${batches.length + 1} (${files.length}张)`;
      
      // 创建初始图片列表（先显示本地预览）
      const newImages: ImageItem[] = files.map((file, index) => ({
        id: nanoid(),
        file,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        city: globalSettings.defaultCity,
        spot: globalSettings.defaultSpot,
        groupType: globalSettings.defaultGroupType,
        faceType: globalSettings.defaultFaceType,
        price: globalSettings.defaultPrice,
        templateId: '',
        templateGroupId: '',
        prompt: '',
        selected: false,
        order: allImages.length + index + 1,
        isUploading: true,
      }));

      const newBatch: ImageBatch = {
        id: newBatchId,
        name: finalBatchName,
        images: newImages,
        isCollapsed: false,
        commonSettings: {
          city: globalSettings.defaultCity,
          spot: globalSettings.defaultSpot,
          groupType: globalSettings.defaultGroupType,
          faceType: globalSettings.defaultFaceType,
          price: globalSettings.defaultPrice,
        },
      };

      setBatches(prev => [...prev, newBatch]);
      setCacheLoaded(true);
      toast.success(`成功添加批次，正在上传图片...`, { id: toastId });

      // 分批串行上传图片，每批5张，避免请求过大
      const BATCH_SIZE = 5;
      const results: { index: number; url: string; fileKey: string; thumbnailUrl?: string; webpUrl?: string; thumbnailWebpUrl?: string; success: boolean }[] = [];

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batchFiles = files.slice(i, i + BATCH_SIZE);
        const batchStartIndex = i;

        // 更新上传进度提示
        toast.loading(`正在上传 ${i + 1}-${Math.min(i + BATCH_SIZE, files.length)}/${files.length} 张图片...`, { id: toastId });

        // 当前批次并行上传
        const batchPromises = batchFiles.map(async (file, idx) => {
          const actualIndex = batchStartIndex + idx;
          try {
            const base64 = await fileToBase64(file);
            const mimeType = file.type || 'image/jpeg';
            const result = await uploadCacheImageMutation.mutateAsync({
              imageBase64: base64,
              fileName: file.name,
              mimeType,
            });
            return { index: actualIndex, url: result.url, fileKey: result.fileKey, thumbnailUrl: result.thumbnailUrl, webpUrl: result.webpUrl, thumbnailWebpUrl: result.thumbnailWebpUrl, success: true };
          } catch (err) {
            console.error(`上传图片失败: ${file.name}`, err);
            return { index: actualIndex, url: '', fileKey: '', success: false };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 实时更新已上传的图片状态
        setBatches(prev => prev.map(batch => {
          if (batch.id === newBatchId) {
            return {
              ...batch,
              images: batch.images.map((img, idx) => {
                const uploadResult = batchResults.find(r => r.index === idx);
                if (uploadResult && uploadResult.success) {
                  return {
                    ...img,
                    previewUrl: uploadResult.url,
                    s3Url: uploadResult.url,
                    s3Key: uploadResult.fileKey,
                    isUploading: false,
                  };
                }
                // 保持之前已上传的状态
                const prevResult = results.find(r => r.index === idx && r.success);
                if (prevResult) {
                  return {
                    ...img,
                    previewUrl: prevResult.url,
                    thumbnailUrl: prevResult.thumbnailUrl || prevResult.url,
                    webpUrl: prevResult.webpUrl,
                    thumbnailWebpUrl: prevResult.thumbnailWebpUrl,
                    s3Url: prevResult.url,
                    s3Key: prevResult.fileKey,
                    isUploading: false,
                  };
                }
                return img;
              }),
            };
          }
          return batch;
        }));
      }

      const successCount = results.filter(r => r.success).length;
      if (successCount === files.length) {
        toast.success(`所有 ${files.length} 张图片已上传完成`, { id: toastId });
      } else {
        toast.warning(`${successCount}/${files.length} 张图片上传成功`, { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error('处理图片时出错', { id: toastId });
    }
  }, [batches.length, allImages.length, globalSettings, uploadCacheImageMutation]);

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addBatch(files);
    }
    e.target.value = '';
  };

  /**
   * 判断文件名是否表示宽脸模板
   */
  function isWideFaceFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return lowerName.includes('宽') ||
           lowerName.includes('wide') ||
           lowerName.includes('_w.') ||
           lowerName.includes('_w_') ||
           lowerName.startsWith('w_') ||
           lowerName.includes('-w.');
  }

  /**
   * 判断文件名是否表示窄脸模板
   */
  function isNarrowFaceFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return lowerName.includes('窄') ||
           lowerName.includes('narrow') ||
           lowerName.includes('_n.') ||
           lowerName.includes('_n_') ||
           lowerName.startsWith('n_') ||
           lowerName.includes('-n.');
  }

  /**
   * 智能文件夹上传处理
   * 支持按人群类型文件夹结构自动识别配对关系
   *
   * 文件夹结构：
   * girl_young/
   * ├── pair_01/           # 配对子文件夹
   * │   ├── 宽脸.jpg       # 宽脸模板
   * │   └── 窄脸.jpg       # 窄脸模板
   * ├── single1.jpg        # 单独模板 → 默认窄脸
   * └── single2.jpg
   */
  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      e.target.value = '';
      return;
    }

    // 解析文件结构
    interface ParsedFile {
      file: File;
      relativePath: string;
      rootFolder: string;      // 第一级文件夹（人群类型）
      subFolder: string | null; // 第二级文件夹（配对文件夹）
      fileName: string;
    }

    const parsedFiles: ParsedFile[] = files
      .filter(f => f.type.startsWith('image/'))
      .map(file => {
        const relativePath = (file as any).webkitRelativePath || file.name;
        const pathParts = relativePath.split('/');

        return {
          file,
          relativePath,
          rootFolder: pathParts[0] || '默认文件夹',
          subFolder: pathParts.length >= 3 ? pathParts[1] : null,
          fileName: pathParts[pathParts.length - 1],
        };
      });

    if (parsedFiles.length === 0) {
      toast.error('未找到图片文件');
      e.target.value = '';
      return;
    }

    // 按根文件夹分组
    const rootFolderMap = new Map<string, ParsedFile[]>();
    parsedFiles.forEach(pf => {
      if (!rootFolderMap.has(pf.rootFolder)) {
        rootFolderMap.set(pf.rootFolder, []);
      }
      rootFolderMap.get(pf.rootFolder)!.push(pf);
    });

    // 处理每个根文件夹
    rootFolderMap.forEach((folderFiles, rootFolderName) => {
      // 检查根文件夹名是否为人群类型（支持代码和中文名两种方式）
      const parsedGroupType = parseGroupTypeFromFolderName(rootFolderName);
      const isGroupTypeFolder = parsedGroupType !== null;
      const groupType = parsedGroupType || globalSettings.defaultGroupType;
      const faceTypeConfig = getFaceTypeConfig(groupType);

      // 按子文件夹分组
      const subFolderMap = new Map<string, ParsedFile[]>();
      const rootLevelFiles: ParsedFile[] = [];

      folderFiles.forEach(pf => {
        if (pf.subFolder) {
          if (!subFolderMap.has(pf.subFolder)) {
            subFolderMap.set(pf.subFolder, []);
          }
          subFolderMap.get(pf.subFolder)!.push(pf);
        } else {
          rootLevelFiles.push(pf);
        }
      });

      const newImages: ImageItem[] = [];
      let orderCounter = allImages.length;

      // 处理配对子文件夹
      subFolderMap.forEach((subFiles, subFolderName) => {
        if (subFiles.length === 2 && faceTypeConfig === 'selectable') {
          // 恰好2张图片 → 自动配对
          const pairGroupId = generateTemplateGroupId(groupType);

          // 识别宽脸和窄脸
          let wideFile: ParsedFile | null = null;
          let narrowFile: ParsedFile | null = null;

          subFiles.forEach(pf => {
            if (isWideFaceFile(pf.fileName)) {
              wideFile = pf;
            } else if (isNarrowFaceFile(pf.fileName)) {
              narrowFile = pf;
            }
          });

          // 智能补全：如果只识别出一种脸型，另一张自动设为相反脸型
          if (wideFile && !narrowFile) {
            // 只识别出宽脸，另一张设为窄脸
            narrowFile = subFiles.find(pf => pf !== wideFile) || null;
          } else if (narrowFile && !wideFile) {
            // 只识别出窄脸，另一张设为宽脸
            wideFile = subFiles.find(pf => pf !== narrowFile) || null;
          } else if (!wideFile && !narrowFile) {
            // 都无法识别，按字母顺序：第一个窄脸，第二个宽脸
            const sorted = [...subFiles].sort((a, b) => a.fileName.localeCompare(b.fileName));
            narrowFile = sorted[0];
            wideFile = sorted[1];
          }

          // 创建配对图片（窄脸在前，宽脸在后）
          [narrowFile, wideFile].forEach((pf, idx) => {
            if (!pf) return;
            const faceType = idx === 0 ? 'narrow' : 'wide';
            orderCounter++;
            newImages.push({
              id: nanoid(),
              file: pf.file,
              previewUrl: URL.createObjectURL(pf.file),
              fileName: pf.fileName,
              city: globalSettings.defaultCity,
              spot: globalSettings.defaultSpot,
              groupType,
              faceType,
              price: globalSettings.defaultPrice,
              templateId: '',
              templateGroupId: pairGroupId,
              prompt: '',
              selected: false,
              order: orderCounter,
              isUploading: true,
            });
          });

          console.log(`[智能配对] 子文件夹 "${subFolderName}" → 配对ID: ${pairGroupId}, 窄脸: ${narrowFile?.fileName}, 宽脸: ${wideFile?.fileName}`);
        } else {
          // 不是恰好2张，或不需要配对 → 全部作为窄脸
          subFiles.forEach(pf => {
            orderCounter++;
            newImages.push({
              id: nanoid(),
              file: pf.file,
              previewUrl: URL.createObjectURL(pf.file),
              fileName: pf.fileName,
              city: globalSettings.defaultCity,
              spot: globalSettings.defaultSpot,
              groupType,
              faceType: 'narrow',
              price: globalSettings.defaultPrice,
              templateId: '',
              templateGroupId: '',
              prompt: '',
              selected: false,
              order: orderCounter,
              isUploading: true,
            });
          });
        }
      });

      // 处理根目录下的单独文件（默认窄脸，无需配对）
      rootLevelFiles.forEach(pf => {
        orderCounter++;
        newImages.push({
          id: nanoid(),
          file: pf.file,
          previewUrl: URL.createObjectURL(pf.file),
          fileName: pf.fileName,
          city: globalSettings.defaultCity,
          spot: globalSettings.defaultSpot,
          groupType,
          faceType: 'narrow',
          price: globalSettings.defaultPrice,
          templateId: '',
          templateGroupId: '',
          prompt: '',
          selected: false,
          order: orderCounter,
          isUploading: true,
        });
      });

      if (newImages.length === 0) return;

      // 统计配对情况
      const pairedCount = newImages.filter(img => img.templateGroupId).length;
      const unpairedCount = newImages.length - pairedCount;

      // 创建批次
      const batchId = nanoid();
      const batchName = isGroupTypeFolder
        ? `${rootFolderName} (${newImages.length}张, ${pairedCount / 2}对配对, ${unpairedCount}张单独)`
        : `${rootFolderName} (${newImages.length}张)`;

      const newBatch: ImageBatch = {
        id: batchId,
        name: batchName,
        images: newImages,
        isCollapsed: false,
        commonSettings: {
          city: globalSettings.defaultCity,
          spot: globalSettings.defaultSpot,
          groupType,
          faceType: 'narrow',
          price: globalSettings.defaultPrice,
        },
      };

      setBatches(prev => [...prev, newBatch]);
      setCacheLoaded(true);

      // 后台上传图片
      uploadBatchImages(batchId, newImages.map(img => img.file!));

      toast.success(`已导入 ${rootFolderName}: ${newImages.length}张图片 (${pairedCount / 2}对配对)`);
    });

    e.target.value = '';
  };

  /**
   * 后台批量上传图片
   */
  const uploadBatchImages = async (batchId: string, files: File[]) => {
    const BATCH_SIZE = 5;
    const results: { index: number; url: string; fileKey: string; thumbnailUrl?: string; webpUrl?: string; thumbnailWebpUrl?: string; success: boolean }[] = [];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batchFiles = files.slice(i, i + BATCH_SIZE);
      const batchStartIndex = i;

      const batchPromises = batchFiles.map(async (file, idx) => {
        const actualIndex = batchStartIndex + idx;
        try {
          const base64 = await fileToBase64(file);
          const mimeType = file.type || 'image/jpeg';
          const result = await uploadCacheImageMutation.mutateAsync({
            imageBase64: base64,
            fileName: file.name,
            mimeType,
          });
          return { index: actualIndex, url: result.url, fileKey: result.fileKey, thumbnailUrl: result.thumbnailUrl, webpUrl: result.webpUrl, thumbnailWebpUrl: result.thumbnailWebpUrl, success: true };
        } catch (err) {
          console.error(`上传图片失败: ${file.name}`, err);
          return { index: actualIndex, url: '', fileKey: '', success: false };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 更新上传状态
      setBatches(prev => prev.map(batch => {
        if (batch.id !== batchId) return batch;

        return {
          ...batch,
          images: batch.images.map((img, imgIdx) => {
            const uploadResult = results.find(r => r.index === imgIdx && r.success);
            if (uploadResult) {
              return {
                ...img,
                previewUrl: uploadResult.url,
                thumbnailUrl: uploadResult.thumbnailUrl || uploadResult.url,
                webpUrl: uploadResult.webpUrl,
                thumbnailWebpUrl: uploadResult.thumbnailWebpUrl,
                s3Url: uploadResult.url,
                s3Key: uploadResult.fileKey,
                isUploading: false,
              };
            }
            return img;
          }),
        };
      }));
    }

    const successCount = results.filter(r => r.success).length;
    if (successCount < files.length) {
      toast.warning(`上传完成: ${successCount}/${files.length} 张成功`);
    }
  };

  // 配对批次输入框引用
  const pairedBatchInputRef = useRef<HTMLInputElement>(null);

  // 创建配对批次（宽脸+窄脸自动配对）
  const addPairedBatch = useCallback(async (files: File[]) => {
    if (files.length < 2) {
      toast.error('配对批次至少需要2张图片（宽脸和窄脸各一张）');
      return;
    }

    const toastId = toast.loading(`正在处理配对批次 (${files.length} 张图片)...`);

    try {
      // 生成配对ID
      const pairGroupId = generateTemplateGroupId(globalSettings.defaultGroupType);

      // 计算每种脸型的图片数量（平均分配）
      const halfCount = Math.ceil(files.length / 2);
      const narrowFiles = files.slice(0, halfCount);
      const wideFiles = files.slice(halfCount);

      const narrowBatchId = nanoid();
      const wideBatchId = nanoid();

      // 创建窄脸批次图片
      const createImages = (batchFiles: File[], faceType: 'wide' | 'narrow', startOrder: number): ImageItem[] => {
        return batchFiles.map((file, index) => ({
          id: nanoid(),
          file,
          previewUrl: URL.createObjectURL(file),
          fileName: file.name,
          city: globalSettings.defaultCity,
          spot: globalSettings.defaultSpot,
          groupType: globalSettings.defaultGroupType,
          faceType,
          price: globalSettings.defaultPrice,
          templateId: '',
          templateGroupId: pairGroupId, // 自动设置配对ID
          prompt: '',
          selected: false,
          order: startOrder + index + 1,
          isUploading: true,
        }));
      };

      const narrowImages = createImages(narrowFiles, 'narrow', allImages.length);
      const wideImages = createImages(wideFiles, 'wide', allImages.length + narrowFiles.length);

      // 创建窄脸批次
      const narrowBatch: ImageBatch = {
        id: narrowBatchId,
        name: `配对-窄脸 (${narrowFiles.length}张) [${pairGroupId}]`,
        images: narrowImages,
        isCollapsed: false,
        isPairedBatch: true,
        pairGroupId,
        commonSettings: {
          city: globalSettings.defaultCity,
          spot: globalSettings.defaultSpot,
          groupType: globalSettings.defaultGroupType,
          faceType: 'narrow',
          price: globalSettings.defaultPrice,
        },
      };

      // 创建宽脸批次
      const wideBatch: ImageBatch = {
        id: wideBatchId,
        name: `配对-宽脸 (${wideFiles.length}张) [${pairGroupId}]`,
        images: wideImages,
        isCollapsed: false,
        isPairedBatch: true,
        pairGroupId,
        commonSettings: {
          city: globalSettings.defaultCity,
          spot: globalSettings.defaultSpot,
          groupType: globalSettings.defaultGroupType,
          faceType: 'wide',
          price: globalSettings.defaultPrice,
        },
      };

      setBatches(prev => [...prev, narrowBatch, wideBatch]);
      setCacheLoaded(true);
      toast.success(`已创建配对批次: ${narrowFiles.length}张窄脸 + ${wideFiles.length}张宽脸`, { id: toastId });

      // 后台上传图片（复用 addBatch 的上传逻辑）
      const allBatchFiles = [...narrowFiles, ...wideFiles];
      const BATCH_SIZE = 5;
      const results: { index: number; url: string; fileKey: string; thumbnailUrl?: string; webpUrl?: string; thumbnailWebpUrl?: string; success: boolean }[] = [];

      for (let i = 0; i < allBatchFiles.length; i += BATCH_SIZE) {
        const batchFiles = allBatchFiles.slice(i, i + BATCH_SIZE);
        const batchStartIndex = i;

        toast.loading(`正在上传 ${i + 1}-${Math.min(i + BATCH_SIZE, allBatchFiles.length)}/${allBatchFiles.length} 张图片...`, { id: toastId });

        const batchPromises = batchFiles.map(async (file, idx) => {
          const actualIndex = batchStartIndex + idx;
          try {
            const base64 = await fileToBase64(file);
            const mimeType = file.type || 'image/jpeg';
            const result = await uploadCacheImageMutation.mutateAsync({
              imageBase64: base64,
              fileName: file.name,
              mimeType,
            });
            return { index: actualIndex, url: result.url, fileKey: result.fileKey, thumbnailUrl: result.thumbnailUrl, webpUrl: result.webpUrl, thumbnailWebpUrl: result.thumbnailWebpUrl, success: true };
          } catch (err) {
            console.error(`上传图片失败: ${file.name}`, err);
            return { index: actualIndex, url: '', fileKey: '', success: false };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 更新上传状态
        setBatches(prev => prev.map(batch => {
          if (batch.id !== narrowBatchId && batch.id !== wideBatchId) return batch;

          const isNarrowBatch = batch.id === narrowBatchId;
          const batchOffset = isNarrowBatch ? 0 : narrowFiles.length;

          return {
            ...batch,
            images: batch.images.map((img, imgIdx) => {
              const globalIdx = batchOffset + imgIdx;
              const uploadResult = results.find(r => r.index === globalIdx && r.success);
              if (uploadResult) {
                return {
                  ...img,
                  previewUrl: uploadResult.url,
                  thumbnailUrl: uploadResult.thumbnailUrl || uploadResult.url,
                  webpUrl: uploadResult.webpUrl,
                  thumbnailWebpUrl: uploadResult.thumbnailWebpUrl,
                  s3Url: uploadResult.url,
                  s3Key: uploadResult.fileKey,
                  isUploading: false,
                };
              }
              return img;
            }),
          };
        }));
      }

      const successCount = results.filter(r => r.success).length;
      if (successCount === allBatchFiles.length) {
        toast.success(`配对批次上传完成: ${successCount} 张图片`, { id: toastId });
      } else {
        toast.warning(`配对批次上传: ${successCount}/${allBatchFiles.length} 张成功`, { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error('创建配对批次失败', { id: toastId });
    }
  }, [allImages.length, globalSettings, uploadCacheImageMutation]);

  // 处理配对批次上传
  const handlePairedBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length >= 2) {
        addPairedBatch(imageFiles);
      } else {
        toast.error('配对批次至少需要2张图片');
      }
    }
    e.target.value = '';
  };

  // 更新批次设置
  const updateBatchSetting = (batchId: string, key: keyof ImageBatch['commonSettings'], value: any) => {
    setBatches(prev => prev.map(batch => {
      if (batch.id !== batchId) return batch;

      let newSettings = { ...batch.commonSettings, [key]: value };
      let newImages = batch.images.map(img => ({ ...img, [key]: value }));

      return { ...batch, commonSettings: newSettings, images: newImages };
    }));
  };

  // 更新单个图片
  const updateImage = (batchId: string, imageId: string, updates: Partial<ImageItem>) => {
    setBatches(prev => prev.map(batch => {
      if (batch.id !== batchId) return batch;

      const newImages = batch.images.map(img => {
        if (img.id !== imageId) return img;
        return { ...img, ...updates };
      });

      return { ...batch, images: newImages };
    }));
  };

  // 删除批次
  const removeBatch = (batchId: string) => {
    setBatches(prev => prev.filter(b => b.id !== batchId));
    toast.success('批次已删除');
  };

  // 删除图片
  const removeImage = (batchId: string, imageId: string) => {
    setBatches(prev => prev.map(batch => {
      if (batch.id !== batchId) return batch;
      return { ...batch, images: batch.images.filter(img => img.id !== imageId) };
    }).filter(batch => batch.images.length > 0));
  };

  // 切换批次折叠
  const toggleBatchCollapse = (batchId: string) => {
    setBatches(prev => prev.map(batch => 
      batch.id === batchId ? { ...batch, isCollapsed: !batch.isCollapsed } : batch
    ));
  };

  // 获取数据库中已存在的模板ID
  const { data: existingTemplateIds } = trpc.template.getAllIds.useQuery();

  // 生成规范文件名（根据人群类型和脸型生成符合规范的模板ID）
  const generateTemplateIds = async () => {
    // 收集所有已存在的ID（数据库 + 当前页面已生成的）
    const usedIds = new Set<string>(existingTemplateIds || []);

    // 先收集当前页面中已有的规范格式ID
    batches.forEach(batch => {
      batch.images.forEach(img => {
        if (img.templateId) {
          usedIds.add(img.templateId);
        }
      });
    });

    let successCount = 0;
    let errorCount = 0;

    setBatches(prev => prev.map(batch => ({
      ...batch,
      images: batch.images.map(img => {
        // 检查是否已配置人群类型
        if (!img.groupType) {
          errorCount++;
          return img;
        }

        try {
          const newTemplateId = generateUniqueTemplateId(img.groupType, img.faceType, usedIds);
          usedIds.add(newTemplateId); // 添加到已用集合，避免重复

          successCount++;
          return {
            ...img,
            templateId: newTemplateId,
            fileName: newTemplateId + (img.fileName.match(/\.[^.]+$/) || ['.jpg'])[0],
          };
        } catch {
          errorCount++;
          return img;
        }
      })
    })));

    if (errorCount > 0) {
      toast.warning(`生成完成：${successCount} 个成功，${errorCount} 个失败（请检查人群类型是否已配置）`);
    } else {
      toast.success(`已成功生成 ${successCount} 个规范模板ID`);
    }
  };

  // 清除缓存
  const handleClearCache = () => {
    if (confirm('确定要清除所有缓存吗？这将清除当前页面的图片和服务器上的缓存数据。')) {
      // 立即清空前端批次列表
      setBatches([]);
      setSelectedImage(null);
      setIsPanelOpen(false);
      setCacheLoaded(false);
      setIsClearing(true);

      // 调用后端API清除服务器缓存
      clearCacheMutation.mutate();
    }
  };

  // 导出ZIP（功能未开发）
  const exportZip = async () => {
    toast.info('导出ZIP功能开发中');
  };

  // 保存到模板库
  const saveMutation = trpc.template.batchImport.useMutation({
    onSuccess: (result: { successCount: number; failCount: number }) => {
      toast.success(`成功保存 ${result.successCount} 个模板到模板库`);
      if (result.failCount > 0) {
        toast.warning(`${result.failCount} 个模板保存失败`);
      }
      setBatches([]);
      // 清除服务器缓存
      clearCacheMutation.mutate();
    },
    onError: (err) => {
      toast.error(err.message || '保存失败');
    },
  });

  const saveToDatabase = async () => {
    if (allImages.length === 0) {
      toast.error('没有可保存的模板');
      return;
    }

    const missingIds = allImages.filter(img => !img.templateId);
    if (missingIds.length > 0) {
      toast.error(`有 ${missingIds.length} 张图片缺少模板ID，请先点击"生成模板ID"按钮`);
      return;
    }

    // 检查是否有图片未上传（本地存储返回 /uploads/，云存储返回 https://）
    const notUploadedImages = allImages.filter(img => {
      const url = img.s3Url || img.previewUrl;
      // blob: 开头表示还未上传完成
      return !url || url.startsWith('blob:');
    });
    if (notUploadedImages.length > 0) {
      toast.error(`有 ${notUploadedImages.length} 张图片未上传完成，请稍后再试`);
      return;
    }

    // P2: 检查宽窄脸配对状态（仅警告，不阻止保存）
    const pairingWarnings = checkPairingStatus(allImages);
    if (pairingWarnings.length > 0) {
      const confirmSave = confirm(
        `检测到以下配对问题:\n\n${pairingWarnings.join('\n')}\n\n确定要继续保存吗？`
      );
      if (!confirmSave) {
        return;
      }
    }

    const templates = allImages.map(img => {
      const groupConfig = groupTypes.find(g => g.code === img.groupType);
      // 优先使用 S3 URL，如果没有则使用 previewUrl（必须是 https 开头的永久URL）
      const imageUrl = img.s3Url || img.previewUrl;

      // 检查是否包含"全国通用"
      const cities = img.city ? img.city.split(',').filter(Boolean) : [];
      const isNational = cities.includes('全国通用');

      return {
        templateId: img.templateId,
        name: img.templateId, // 使用模板ID作为文件名
        imageUrl: imageUrl,
        thumbnailUrl: img.thumbnailUrl || imageUrl, // 同时保存缩略图URL
        city: img.city, // 逗号分隔的城市列表
        scenicSpot: img.spot, // 逗号分隔的景点列表
        groupType: img.groupType,
        photoType: (groupConfig?.photoType || 'single') as 'single' | 'group',
        faceType: img.faceType,
        isNational: isNational, // 是否全国通用
        templateGroupId: img.templateGroupId, // 模板配对ID，用于宽脸/窄脸关联
        price: img.price,
        isFree: img.price === 0,
        prompt: img.prompt,
      };
    });

    saveMutation.mutate(templates);
  };

  /**
   * 检查宽窄脸配对状态
   * 返回警告信息列表
   */
  function checkPairingStatus(images: ImageItem[]): string[] {
    const warnings: string[] = [];

    // 筛选出需要配对的图片（selectable 类型）
    const selectableImages = images.filter(img =>
      getFaceTypeConfig(img.groupType) === 'selectable'
    );

    if (selectableImages.length === 0) {
      return warnings;
    }

    // 按 templateGroupId 分组
    const groupedByPairId = new Map<string, ImageItem[]>();
    const unpaired: ImageItem[] = [];

    selectableImages.forEach(img => {
      if (img.templateGroupId) {
        if (!groupedByPairId.has(img.templateGroupId)) {
          groupedByPairId.set(img.templateGroupId, []);
        }
        groupedByPairId.get(img.templateGroupId)!.push(img);
      } else {
        unpaired.push(img);
      }
    });

    // 检查未配对的图片
    if (unpaired.length > 0) {
      warnings.push(`• ${unpaired.length} 张需要配对的图片缺少配对ID`);
    }

    // 检查每个配对组的完整性
    groupedByPairId.forEach((pairImages, pairId) => {
      const wideImages = pairImages.filter(img => img.faceType === 'wide');
      const narrowImages = pairImages.filter(img => img.faceType === 'narrow');

      if (wideImages.length === 0) {
        warnings.push(`• 配对组 [${pairId}] 缺少宽脸模板 (当前: ${narrowImages.length}张窄脸)`);
      }
      if (narrowImages.length === 0) {
        warnings.push(`• 配对组 [${pairId}] 缺少窄脸模板 (当前: ${wideImages.length}张宽脸)`);
      }
    });

    return warnings;
  }

  // 拖拽排序传感器 - 必须在条件返回之前调用
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 移动 8px 后才开始拖拽
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // 保存默认设置到 localStorage
  const handleSaveSettings = () => {
    localStorage.setItem('templateConfigSettings', JSON.stringify(globalSettings));
    toast.success('默认设置已保存');
    setShowSettings(false);
  };

  // 选择图片预览
  const handleSelectImage = (img: ImageItem) => {
    setSelectedImage(img);
    if (!isPanelOpen) {
      setIsPanelOpen(true);
    }
  };

  // 拖拽结束处理
  const handleDragEnd = (batchId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setBatches(prev => prev.map(batch => {
        if (batch.id !== batchId) return batch;
        
        const oldIndex = batch.images.findIndex(img => img.id === active.id);
        const newIndex = batch.images.findIndex(img => img.id === over.id);
        
        if (oldIndex === -1 || newIndex === -1) return batch;
        
        const newImages = arrayMove(batch.images, oldIndex, newIndex);
        // 更新排序值
        const updatedImages = newImages.map((img, idx) => ({
          ...img,
          order: idx + 1,
        }));
        
        return {
          ...batch,
          images: updatedImages,
        };
      }));
      
      toast.success('排序已更新');
    }
  };

  // 上一张/下一张导航
  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    const currentIndex = allImages.findIndex(img => img.id === selectedImage.id);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : allImages.length - 1;
    } else {
      newIndex = currentIndex < allImages.length - 1 ? currentIndex + 1 : 0;
    }
    setSelectedImage(allImages[newIndex]);
  };

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* 左侧主内容区 */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 overflow-y-auto",
          isPanelOpen ? "mr-0" : ""
        )}>
          <div className="space-y-4 p-3">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">模板配置</h1>
                <p className="text-sm text-muted-foreground">批量上传和配置换脸模板</p>
              </div>
              <div className="flex items-center gap-2">
                {/* 设置按钮 - 右上角不起眼位置 */}
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="text-muted-foreground">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 操作栏 - 吸顶效果 */}
        <div ref={toolbarRef}>
          <Card className={cn(
            "transition-all duration-300",
            isSticky && "fixed top-0 right-0 z-50 rounded-none border-t-0 border-x-0 shadow-md"
          )} style={isSticky ? { left: '280px', width: 'calc(100% - 280px)' } : undefined}>
            <CardContent className="py-2 px-3">
              {/* 单行布局：左侧操作按钮 + 右侧统计信息 */}
              <div className="flex items-center justify-between gap-2">
                {/* 左侧：操作按钮 */}
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={generateTemplateIds}>
                    <Wand2 className="w-3 h-3 mr-1" />
                    生成模板ID
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => pairedBatchInputRef.current?.click()} title="创建宽窄脸配对批次（图片将平均分配为宽脸和窄脸）">
                    <Users className="w-3 h-3 mr-1" />
                    配对批次
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => toast.info('AI描述生成功能开发中')}
                    disabled
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI描述
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => folderInputRef.current?.click()}>
                    <FolderOpen className="w-3 h-3 mr-1" />
                    导入文件夹
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => fileInputRef.current?.click()}>
                    <FolderPlus className="w-3 h-3 mr-1" />
                    添加批次
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={exportZip}
                    disabled
                  >
                    <Package className="w-3 h-3 mr-1" />
                    导出ZIP
                  </Button>
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={saveToDatabase} disabled={saveMutation.isPending}>
                    <Save className="w-3 h-3 mr-1" />
                    保存模板库
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={handleClearCache}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    清缓存
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    {...{ webkitdirectory: '', directory: '' } as any}
                    onChange={handleFolderUpload}
                  />
                  <input
                    ref={pairedBatchInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handlePairedBatchUpload}
                  />
                </div>
                {/* 右侧：统计信息 */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  <span>批次: <span className="font-medium text-foreground">{batches.length}</span></span>
                  <span>图片: <span className="font-medium text-foreground">{allImages.length}</span></span>
                  <span>已生成ID: <span className="font-medium text-foreground">{allImages.filter(i => i.templateId).length}</span></span>
                  <span>已选: <span className="font-medium text-foreground">{selectedIds.length}</span></span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 占位元素，防止吸顶时内容跳动 */}
        {isSticky && <div className="h-[56px]" />}

        {/* 批次列表 */}
        {batches.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无图片</h3>
              <p className="text-muted-foreground mb-4">点击"添加批次"上传模板图片，或"导入文件夹"批量导入</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => folderInputRef.current?.click()}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  导入文件夹
                </Button>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  上传图片
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {batches.map(batch => (
              <Card key={batch.id}>
                <CardHeader className="p-4 cursor-pointer" onClick={() => toggleBatchCollapse(batch.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {batch.isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                      <CardTitle className="text-base">{batch.name}</CardTitle>
                      <span className="text-sm text-muted-foreground">
                        ({batch.images.length}张)
                      </span>

                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <div className="w-[140px]">
                        <MultiCitySelect
                          value={batch.commonSettings.city}
                          onChange={(v) => updateBatchSetting(batch.id, 'city', v)}
                          citySpots={citySpots}
                        />
                      </div>
                      <div className="w-[160px]">
                        <MultiSpotSelect
                          value={batch.commonSettings.spot}
                          onChange={(v) => updateBatchSetting(batch.id, 'spot', v)}
                          cityValue={batch.commonSettings.city}
                          citySpots={citySpots}
                        />
                      </div>
                      <Select
                        value={batch.commonSettings.groupType}
                        onValueChange={(v) => {
                          // 当人群类型改变时，自动调整脸型
                          updateBatchSetting(batch.id, 'groupType', v);
                          const faceTypeConfig = getFaceTypeConfig(v);

                          if (faceTypeConfig === 'selectable') {
                            // 可选择宽脸/窄脸：如果当前是通用或固定窄脸，默认设为窄脸
                            if (batch.commonSettings.faceType !== 'wide' && batch.commonSettings.faceType !== 'narrow') {
                              updateBatchSetting(batch.id, 'faceType', 'narrow');
                            }
                          } else if (faceTypeConfig === 'fixed-narrow') {
                            // 固定为窄脸
                            updateBatchSetting(batch.id, 'faceType', 'narrow');
                          } else {
                            // 通用：不需要区分脸型
                            updateBatchSetting(batch.id, 'faceType', 'both');
                          }
                        }}
                      >
                        <SelectTrigger className="w-[100px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {groupTypes.map(g => (
                            <SelectItem key={g.code} value={g.code}>{g.displayName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* 脸型选择与人群类型联动 */}
                      {(() => {
                        const faceTypeConfig = getFaceTypeConfig(batch.commonSettings.groupType);

                        if (faceTypeConfig === 'selectable') {
                          // 少女、熟女、奶奶、少男、大叔：可选择宽脸和窄脸
                          return (
                            <Select
                              value={batch.commonSettings.faceType}
                              onValueChange={(v) => updateBatchSetting(batch.id, 'faceType', v as any)}
                            >
                              <SelectTrigger className="w-[80px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="narrow">窄脸</SelectItem>
                                <SelectItem value="wide">宽脸</SelectItem>
                              </SelectContent>
                            </Select>
                          );
                        } else if (faceTypeConfig === 'fixed-narrow') {
                          // 幼女、幼男、合照：固定为窄脸
                          return (
                            <div className="w-[80px] h-8 px-3 flex items-center text-sm text-muted-foreground bg-muted/50 rounded-md">
                              窄脸 (固定)
                            </div>
                          );
                        } else {
                          // 其他类型：通用
                          return (
                            <div className="w-[80px] h-8 px-3 flex items-center text-sm text-muted-foreground bg-muted/50 rounded-md">
                              通用
                            </div>
                          );
                        }
                      })()}
                      <Select
                        value={batch.commonSettings.price.toString()}
                        onValueChange={(v) => updateBatchSetting(batch.id, 'price', parseInt(v))}
                      >
                        <SelectTrigger className="w-[80px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRICE_OPTIONS.map(p => (
                            <SelectItem key={p} value={p.toString()}>
                              {p === 0 ? '免费' : `${p}积分`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* 背景遮盖选项 */}
                      <Button
                        variant={batch.commonSettings.hasMaskRegions ? "default" : "outline"}
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          if (batch.commonSettings.hasMaskRegions) {
                            // 取消遮盖
                            updateBatchSetting(batch.id, 'hasMaskRegions', false);
                            // 清除所有图片的遮盖配置
                            setBatches(prev => prev.map(b => {
                              if (b.id !== batch.id) return b;
                              return {
                                ...b,
                                images: b.images.map(img => ({
                                  ...img,
                                  hasMaskRegions: false,
                                  maskRegions: undefined,
                                  maskedImageUrl: undefined,
                                  regionCacheUrl: undefined,
                                })),
                              };
                            }));
                          } else {
                            // 开启遮盖，打开遮盖配置弹窗
                            setMaskConfigBatchId(batch.id);
                            setShowMaskConfigDialog(true);
                          }
                        }}
                      >
                        {batch.commonSettings.hasMaskRegions ? '已配置遮盖' : '背景遮盖'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeBatch(batch.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {!batch.isCollapsed && (
                  <CardContent className="p-4 pt-0">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd(batch.id)}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[60px]">排序</TableHead>
                            <TableHead className="w-[80px]">预览</TableHead>
                            <TableHead className="w-[100px]">城市</TableHead>
                            <TableHead className="w-[120px]">景点</TableHead>
                            <TableHead className="w-[100px]">人群类型</TableHead>
                            <TableHead className="w-[80px]">脸型</TableHead>
                            <TableHead className="w-[80px]">积分</TableHead>
                            <TableHead className="w-[160px]">模板ID</TableHead>
                            <TableHead className="w-[140px]">配对ID</TableHead>
                            <TableHead className="w-[60px]">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <SortableContext
                          items={batch.images.map(img => img.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <TableBody>
                            {batch.images.map((img, index) => (
                              <SortableTableRow
                                key={img.id}
                                img={img}
                                batch={batch}
                                selectedImage={selectedImage}
                                handleSelectImage={handleSelectImage}
                                updateImage={updateImage}
                                removeImage={removeImage}
                                citySpots={citySpots}
                                groupTypes={groupTypes}
                              />
                            ))}
                          </TableBody>
                        </SortableContext>
                      </Table>
                    </DndContext>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* 图片预览对话框 */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{previewImage?.fileName}</DialogTitle>
            </DialogHeader>
            {previewImage && (
              <div className="space-y-4">
                <div className="aspect-[3/4] max-h-[60vh] overflow-hidden rounded-lg">
                  {previewImage.previewUrl ? (
                    <img
                      src={previewImage.previewUrl}
                      alt={previewImage.fileName}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <div className="text-center">
                        <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">图片来自缓存，无法预览</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">城市</Label>
                    <p>{previewImage.city}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">景点</Label>
                    <p>{previewImage.spot}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">人群类型</Label>
                    <p>{previewImage.groupType}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">脸型</Label>
                    <p>{previewImage.faceType === 'wide' ? '宽脸' : previewImage.faceType === 'narrow' ? '窄脸' : '通用'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">积分</Label>
                    <p>{previewImage.price === 0 ? '免费' : `${previewImage.price}积分`}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">模板ID</Label>
                    <p className="font-mono">{previewImage.templateId || '未生成'}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 设置对话框 */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>默认设置</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>默认城市</Label>
                <MultiCitySelect
                  value={globalSettings.defaultCity}
                  onChange={(v) => setGlobalSettings(prev => ({ ...prev, defaultCity: v }))}
                  citySpots={citySpots}
                />
              </div>
              <div className="space-y-2">
                <Label>默认景点</Label>
                <MultiSpotSelect
                  value={globalSettings.defaultSpot}
                  onChange={(v) => setGlobalSettings(prev => ({ ...prev, defaultSpot: v }))}
                  cityValue={globalSettings.defaultCity}
                  citySpots={citySpots}
                />
              </div>
              <div className="space-y-2">
                <Label>默认人群类型</Label>
                <Select
                  value={globalSettings.defaultGroupType}
                  onValueChange={(v) => {
                    // 当人群类型改变时，自动调整脸型
                    const faceTypeConfig = getFaceTypeConfig(v);
                    let newFaceType: 'wide' | 'narrow' | 'both';

                    if (faceTypeConfig === 'selectable') {
                      // 可选择宽脸/窄脸：保持当前选择或默认为窄脸
                      newFaceType = (globalSettings.defaultFaceType === 'wide' || globalSettings.defaultFaceType === 'narrow')
                        ? globalSettings.defaultFaceType
                        : 'narrow';
                    } else if (faceTypeConfig === 'fixed-narrow') {
                      // 固定为窄脸
                      newFaceType = 'narrow';
                    } else {
                      // 通用
                      newFaceType = 'both';
                    }

                    setGlobalSettings(prev => ({
                      ...prev,
                      defaultGroupType: v,
                      defaultFaceType: newFaceType,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groupTypes.map(g => (
                      <SelectItem key={g.code} value={g.code}>{g.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>默认脸型</Label>
                {/* 脸型选择与人群类型联动 */}
                {(() => {
                  const faceTypeConfig = getFaceTypeConfig(globalSettings.defaultGroupType);

                  if (faceTypeConfig === 'selectable') {
                    // 少女、熟女、奶奶、少男、大叔：可选择宽脸和窄脸
                    return (
                      <Select
                        value={globalSettings.defaultFaceType}
                        onValueChange={(v) => setGlobalSettings(prev => ({ ...prev, defaultFaceType: v as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="narrow">窄脸</SelectItem>
                          <SelectItem value="wide">宽脸</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                  } else if (faceTypeConfig === 'fixed-narrow') {
                    // 幼女、幼男、合照：固定为窄脸
                    return (
                      <div className="h-10 px-3 flex items-center text-sm text-muted-foreground bg-muted/50 rounded-md border">
                        窄脸 (当前人群类型固定为窄脸)
                      </div>
                    );
                  } else {
                    // 其他类型：通用
                    return (
                      <div className="h-10 px-3 flex items-center text-sm text-muted-foreground bg-muted/50 rounded-md border">
                        通用 (当前人群类型不需要区分脸型)
                      </div>
                    );
                  }
                })()}
              </div>
              <div className="space-y-2">
                <Label>默认积分</Label>
                <Select
                  value={globalSettings.defaultPrice.toString()}
                  onValueChange={(v) => setGlobalSettings(prev => ({ ...prev, defaultPrice: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_OPTIONS.map(p => (
                      <SelectItem key={p} value={p.toString()}>
                        {p === 0 ? '免费' : `${p}积分`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowSettings(false)}>取消</Button>
                <Button onClick={handleSaveSettings}>保存设置</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
          </div>
        </div>

        {/* 右侧预览面板 */}
        <aside 
          className={cn(
            "flex-shrink-0 border-l bg-card overflow-y-auto transition-all duration-300 ease-in-out",
            isPanelOpen ? "w-80" : "w-0 border-l-0"
          )}
        >
          {isPanelOpen && (
            <ImagePreviewPanel 
              image={selectedImage}
              allImages={allImages}
              groupTypes={groupTypes}
              onClose={() => {
                setIsPanelOpen(false);
                setSelectedImage(null);
              }}
              onNavigate={navigateImage}
              onPreviewFull={setPreviewImage}
            />
          )}
        </aside>
      </div>
      
      {/* 遮盖区域配置弹窗 */}
      {maskConfigBatchId && (
        <MaskRegionConfig
          open={showMaskConfigDialog}
          onOpenChange={(open) => {
            setShowMaskConfigDialog(open);
            if (!open) setMaskConfigBatchId(null);
          }}
          images={batches.find(b => b.id === maskConfigBatchId)?.images.map(img => ({
            id: img.id,
            previewUrl: img.previewUrl,
            fileName: img.fileName,
            maskRegions: img.maskRegions,
          })) || []}
          onSave={(updatedImages) => {
            setBatches(prev => prev.map(batch => {
              if (batch.id !== maskConfigBatchId) return batch;
              
              // 检查是否有任何图片配置了遮盖区域
              const hasAnyMask = updatedImages.some(img => img.maskRegions && img.maskRegions.length > 0);
              
              return {
                ...batch,
                commonSettings: {
                  ...batch.commonSettings,
                  hasMaskRegions: hasAnyMask,
                },
                images: batch.images.map(img => {
                  const updated = updatedImages.find(u => u.id === img.id);
                  if (!updated) return img;
                  return {
                    ...img,
                    hasMaskRegions: updated.maskRegions && updated.maskRegions.length > 0,
                    maskRegions: updated.maskRegions,
                  };
                }),
              };
            }));
          }}
        />
      )}
    </AdminLayout>
  );
}

// 右侧预览面板组件
function ImagePreviewPanel({ 
  image, 
  allImages,
  groupTypes,
  onClose,
  onNavigate,
  onPreviewFull
}: { 
  image: ImageItem | null;
  allImages: ImageItem[];
  groupTypes: GroupType[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onPreviewFull: (img: ImageItem) => void;
}) {
  if (!image) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center">
        <div>
          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>点击表格行选择一个图片预览</p>
        </div>
      </div>
    );
  }

  const currentIndex = allImages.findIndex(img => img.id === image.id);
  const groupTypeDisplay = groupTypes.find(g => g.code === image.groupType)?.displayName || image.groupType;

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium truncate flex-1" title={image.fileName}>
          {image.templateId || image.fileName}
        </h3>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* 图片预览 */}
      <div className="p-4">
        <div 
          className="aspect-[3/4] relative bg-muted rounded-lg overflow-hidden border cursor-pointer"
          onClick={() => onPreviewFull(image)}
        >
          {image.previewUrl ? (
            <img
              src={image.previewUrl}
              alt={image.fileName}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
          )}

        </div>
      </div>

      {/* 导航按钮 */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onNavigate('prev')}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            上一张
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {allImages.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => onNavigate('next')}>
            下一张
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* 详细信息 */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium">图片信息</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">模板ID</span>
              <span className="font-mono text-xs truncate max-w-[150px]" title={image.templateId}>
                {image.templateId || '未生成'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">城市</span>
              <span>{image.city}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">景点</span>
              <span>{image.spot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">人群类型</span>
              <span>{groupTypeDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">脸型适配</span>
              <span>
                {image.faceType === 'both' ? '通用' : 
                 image.faceType === 'wide' ? '宽脸' : '窄脸'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">积分</span>
              <span className="text-[#e89a8d]">
                {image.price === 0 ? '免费' : `${image.price}积分`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">序号</span>
              <span>{image.order}</span>
            </div>
            {image.s3Url && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground block mb-1">云端存储</span>
                <Badge variant="secondary" className="text-xs">
                  <Database className="w-3 h-3 mr-1" />
                  已上传
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
