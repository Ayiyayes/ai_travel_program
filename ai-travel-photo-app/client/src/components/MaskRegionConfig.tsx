import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Trash2, Copy, Check, Square, MousePointer2, X } from 'lucide-react';
import { nanoid } from 'nanoid';

// 遮盖区域类型
export interface MaskRegion {
  id: string;
  x: number;      // 百分比 0-1
  y: number;      // 百分比 0-1
  width: number;  // 百分比 0-1
  height: number; // 百分比 0-1
  label?: string;
}

// 图片项类型（简化版）
interface ImageItem {
  id: string;
  previewUrl: string;
  fileName: string;
  maskRegions?: MaskRegion[];
}

interface MaskRegionConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ImageItem[];
  onSave: (updatedImages: ImageItem[]) => void;
}

export default function MaskRegionConfig({
  open,
  onOpenChange,
  images,
  onSave,
}: MaskRegionConfigProps) {
  // 当前选中的图片索引
  const [currentIndex, setCurrentIndex] = useState(0);
  // 图片的遮盖区域配置（本地状态）
  const [imageConfigs, setImageConfigs] = useState<Map<string, MaskRegion[]>>(new Map());
  // 选中的图片ID列表（用于批量应用）
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  // 当前正在绘制的区域
  const [drawingRegion, setDrawingRegion] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  // 是否正在绘制
  const [isDrawing, setIsDrawing] = useState(false);
  
  // 图片容器ref
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  // 当前图片
  const currentImage = images[currentIndex];
  // 当前图片的遮盖区域
  const currentRegions = imageConfigs.get(currentImage?.id) || [];
  
  // 初始化配置
  useEffect(() => {
    if (open && images.length > 0) {
      const configs = new Map<string, MaskRegion[]>();
      images.forEach(img => {
        configs.set(img.id, img.maskRegions || []);
      });
      setImageConfigs(configs);
      setCurrentIndex(0);
      setSelectedImageIds(new Set());
    }
  }, [open, images]);
  
  // 获取鼠标在图片上的相对位置（百分比）
  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!imageContainerRef.current) return { x: 0, y: 0 };
    
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    return { x, y };
  }, []);
  
  // 开始绘制
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getRelativePosition(e);
    setDrawingRegion({
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
    setIsDrawing(true);
  }, [getRelativePosition]);
  
  // 绘制中
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !drawingRegion) return;
    
    const pos = getRelativePosition(e);
    setDrawingRegion(prev => prev ? {
      ...prev,
      currentX: pos.x,
      currentY: pos.y,
    } : null);
  }, [isDrawing, drawingRegion, getRelativePosition]);
  
  // 结束绘制
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !drawingRegion || !currentImage) {
      setIsDrawing(false);
      setDrawingRegion(null);
      return;
    }
    
    // 计算区域
    const x = Math.min(drawingRegion.startX, drawingRegion.currentX);
    const y = Math.min(drawingRegion.startY, drawingRegion.currentY);
    const width = Math.abs(drawingRegion.currentX - drawingRegion.startX);
    const height = Math.abs(drawingRegion.currentY - drawingRegion.startY);
    
    // 忽略太小的区域
    if (width < 0.02 || height < 0.02) {
      setIsDrawing(false);
      setDrawingRegion(null);
      return;
    }
    
    // 添加新区域
    const newRegion: MaskRegion = {
      id: nanoid(8),
      x,
      y,
      width,
      height,
      label: `区域${currentRegions.length + 1}`,
    };
    
    setImageConfigs(prev => {
      const newConfigs = new Map(prev);
      const regions = [...(newConfigs.get(currentImage.id) || []), newRegion];
      newConfigs.set(currentImage.id, regions);
      return newConfigs;
    });
    
    setIsDrawing(false);
    setDrawingRegion(null);
  }, [isDrawing, drawingRegion, currentImage, currentRegions.length]);
  
  // 删除区域
  const removeRegion = useCallback((regionId: string) => {
    if (!currentImage) return;
    
    setImageConfigs(prev => {
      const newConfigs = new Map(prev);
      const regions = (newConfigs.get(currentImage.id) || []).filter(r => r.id !== regionId);
      newConfigs.set(currentImage.id, regions);
      return newConfigs;
    });
  }, [currentImage]);
  
  // 清除当前图片的所有区域
  const clearAllRegions = useCallback(() => {
    if (!currentImage) return;
    
    setImageConfigs(prev => {
      const newConfigs = new Map(prev);
      newConfigs.set(currentImage.id, []);
      return newConfigs;
    });
  }, [currentImage]);
  
  // 应用当前配置到选中的图片
  const applyToSelected = useCallback(() => {
    if (!currentImage || selectedImageIds.size === 0) {
      toast.error('请先选择要应用的图片');
      return;
    }
    
    const currentConfig = imageConfigs.get(currentImage.id) || [];
    if (currentConfig.length === 0) {
      toast.error('当前图片没有遮盖区域配置');
      return;
    }
    
    setImageConfigs(prev => {
      const newConfigs = new Map(prev);
      selectedImageIds.forEach(imageId => {
        if (imageId !== currentImage.id) {
          // 复制区域配置，生成新的ID
          const copiedRegions = currentConfig.map(r => ({
            ...r,
            id: nanoid(8),
          }));
          newConfigs.set(imageId, copiedRegions);
        }
      });
      return newConfigs;
    });
    
    toast.success(`已应用到 ${selectedImageIds.size - (selectedImageIds.has(currentImage.id) ? 1 : 0)} 张图片`);
    setSelectedImageIds(new Set());
  }, [currentImage, selectedImageIds, imageConfigs]);
  
  // 切换图片选中状态
  const toggleImageSelection = useCallback((imageId: string) => {
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  }, []);
  
  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedImageIds.size === images.length) {
      setSelectedImageIds(new Set());
    } else {
      setSelectedImageIds(new Set(images.map(img => img.id)));
    }
  }, [images, selectedImageIds.size]);
  
  // 保存配置
  const handleSave = useCallback(() => {
    const updatedImages = images.map(img => ({
      ...img,
      maskRegions: imageConfigs.get(img.id) || [],
    }));
    onSave(updatedImages);
    onOpenChange(false);
    toast.success('遮盖配置已保存');
  }, [images, imageConfigs, onSave, onOpenChange]);
  
  // 计算绘制中的区域样式
  const getDrawingRegionStyle = () => {
    if (!drawingRegion) return {};
    
    const x = Math.min(drawingRegion.startX, drawingRegion.currentX);
    const y = Math.min(drawingRegion.startY, drawingRegion.currentY);
    const width = Math.abs(drawingRegion.currentX - drawingRegion.startX);
    const height = Math.abs(drawingRegion.currentY - drawingRegion.startY);
    
    return {
      left: `${x * 100}%`,
      top: `${y * 100}%`,
      width: `${width * 100}%`,
      height: `${height * 100}%`,
    };
  };
  
  // 统计已配置遮盖的图片数量
  const configuredCount = Array.from(imageConfigs.values()).filter(regions => regions.length > 0).length;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-screen max-h-screen p-0 flex flex-col rounded-none border-0"
        showCloseButton={false}
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
          <DialogTitle className="flex items-center gap-2 text-lg">
            遮盖区域配置
            <Badge variant="secondary">
              {configuredCount}/{images.length} 张已配置
            </Badge>
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              <Check className="w-4 h-4 mr-1" />
              保存配置
            </Button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* 左侧：图片列表（收窄） */}
          <div className="w-[160px] flex flex-col border-r bg-muted/30">
            <div className="p-2 border-b flex items-center justify-between">
              <span className="text-sm font-medium">图片列表</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="h-6 px-2 text-xs"
              >
                {selectedImageIds.size === images.length ? '取消' : '全选'}
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {images.map((img, index) => {
                  const hasConfig = (imageConfigs.get(img.id) || []).length > 0;
                  const isSelected = selectedImageIds.has(img.id);
                  const isCurrent = index === currentIndex;

                  return (
                    <div
                      key={img.id}
                      className={cn(
                        "relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                        isCurrent ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30",
                        isSelected && "ring-2 ring-blue-500"
                      )}
                    >
                      <div
                        className="aspect-[4/3] bg-muted"
                        onClick={() => setCurrentIndex(index)}
                      >
                        <img
                          src={img.previewUrl}
                          alt={img.fileName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* 选择复选框 */}
                      <div
                        className="absolute top-1 left-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleImageSelection(img.id);
                        }}
                      >
                        <Checkbox checked={isSelected} />
                      </div>
                      {/* 已配置标记 */}
                      {hasConfig && (
                        <Badge
                          variant="default"
                          className="absolute top-1 right-1 text-xs px-1"
                        >
                          {(imageConfigs.get(img.id) || []).length}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* 中间：主要绘制区域（扩大） */}
          <div className="flex-1 flex flex-col min-w-0 p-4">
            {/* 工具栏 */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
                <MousePointer2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">拖拽绘制矩形框标记遮盖区域</span>
              </div>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllRegions}
                disabled={currentRegions.length === 0}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                清除全部
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={applyToSelected}
                disabled={selectedImageIds.size === 0 || currentRegions.length === 0}
              >
                <Copy className="w-4 h-4 mr-1" />
                应用到选中 ({selectedImageIds.size})
              </Button>
            </div>

            {/* 图片标记区域 - 主要区域 */}
            <div
              ref={imageContainerRef}
              className="flex-1 relative bg-black/5 rounded-lg overflow-hidden cursor-crosshair select-none border-2 border-dashed border-muted-foreground/20"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {currentImage && (
                <img
                  src={currentImage.previewUrl}
                  alt={currentImage.fileName}
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              )}

              {/* 已保存的遮盖区域 */}
              {currentRegions.map((region) => (
                <div
                  key={region.id}
                  className="absolute border-2 border-red-500 bg-red-500/30 group"
                  style={{
                    left: `${region.x * 100}%`,
                    top: `${region.y * 100}%`,
                    width: `${region.width * 100}%`,
                    height: `${region.height * 100}%`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRegion(region.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <span className="absolute bottom-0 left-0 text-xs bg-red-500 text-white px-1">
                    {region.label}
                  </span>
                </div>
              ))}

              {/* 正在绘制的区域 */}
              {isDrawing && drawingRegion && (
                <div
                  className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20"
                  style={getDrawingRegionStyle()}
                />
              )}
            </div>

            {/* 当前图片信息 */}
            {currentImage && (
              <div className="mt-2 text-sm text-muted-foreground">
                {currentImage.fileName} - {currentRegions.length} 个遮盖区域
              </div>
            )}
          </div>

          {/* 右侧：区域列表（收窄） */}
          <div className="w-[160px] flex flex-col border-l bg-muted/30">
            <div className="p-2 border-b">
              <span className="text-sm font-medium">遮盖区域列表</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {currentRegions.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    暂无遮盖区域
                  </div>
                ) : (
                  currentRegions.map((region, index) => (
                    <div
                      key={region.id}
                      className="flex items-center justify-between p-2 rounded bg-background"
                    >
                      <div className="flex items-center gap-2">
                        <Square className="w-4 h-4 text-red-500" />
                        <span className="text-sm">{region.label || `区域${index + 1}`}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6"
                        onClick={() => removeRegion(region.id)}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


