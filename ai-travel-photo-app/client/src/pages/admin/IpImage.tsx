import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Image, Save, Upload, Info, X, Loader2 } from "lucide-react";

export default function IpImage() {
  const utils = trpc.useUtils();
  
  // 查询现有配置
  const { data: configs = [], isLoading } = trpc.admin.systemConfigs.useQuery();
  
  // 本地表单状态 - P0欢迎页IP形象
  const [ipImageUrl, setIpImageUrl] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 本地表单状态 - 摄像头权限提醒图片
  const [cameraPermissionImageUrl, setCameraPermissionImageUrl] = useState("");
  const [cameraPermissionHasChanges, setCameraPermissionHasChanges] = useState(false);
  const [isCameraPermissionUploading, setIsCameraPermissionUploading] = useState(false);
  const [cameraPermissionPreviewUrl, setCameraPermissionPreviewUrl] = useState<string | null>(null);
  const cameraPermissionFileInputRef = useRef<HTMLInputElement>(null);
  
  // 上传图片 mutation - P0欢迎页
  const uploadMutation = trpc.admin.uploadIpImage.useMutation({
    onSuccess: (data) => {
      setIpImageUrl(data.url);
      setHasChanges(true);
      toast.success("图片上传成功");
    },
    onError: (error) => {
      toast.error(error.message || "图片上传失败");
    },
  });

  // 上传图片 mutation - 摄像头权限提醒
  const uploadCameraPermissionMutation = trpc.admin.uploadIpImage.useMutation({
    onSuccess: (data) => {
      setCameraPermissionImageUrl(data.url);
      setCameraPermissionHasChanges(true);
      toast.success("摄像头权限提醒图片上传成功");
    },
    onError: (error) => {
      toast.error(error.message || "图片上传失败");
    },
  });
  
  // 初始化表单数据
  useEffect(() => {
    const ipConfig = configs.find((c) => c.configKey === "ip_image_url");
    if (ipConfig) {
      setIpImageUrl(ipConfig.configValue);
    }
    const cameraPermissionConfig = configs.find((c) => c.configKey === "camera_permission_image_url");
    if (cameraPermissionConfig) {
      setCameraPermissionImageUrl(cameraPermissionConfig.configValue);
    }
  }, [configs]);
  
  // 保存配置 - P0欢迎页
  const saveConfigMutation = trpc.admin.saveSystemConfig.useMutation({
    onSuccess: () => {
      toast.success("IP形象配置保存成功");
      utils.admin.systemConfigs.invalidate();
      setHasChanges(false);
      setPreviewUrl(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 保存配置 - 摄像头权限提醒
  const saveCameraPermissionConfigMutation = trpc.admin.saveSystemConfig.useMutation({
    onSuccess: () => {
      toast.success("摄像头权限提醒图片保存成功");
      utils.admin.systemConfigs.invalidate();
      setCameraPermissionHasChanges(false);
      setCameraPermissionPreviewUrl(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 处理保存 - P0欢迎页
  const handleSave = () => {
    saveConfigMutation.mutate({
      key: "ip_image_url",
      value: ipImageUrl,
      description: "P0欢迎页IP形象图片URL",
    });
  };

  // 处理保存 - 摄像头权限提醒
  const handleSaveCameraPermission = () => {
    saveCameraPermissionConfigMutation.mutate({
      key: "camera_permission_image_url",
      value: cameraPermissionImageUrl,
      description: "摄像头权限提醒图片URL（Page4）",
    });
  };
  
  // 处理文件选择
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error("请选择图片文件");
      return;
    }
    
    // 验证文件大小 (最大 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片大小不能超过 2MB");
      return;
    }
    
    // 创建本地预览
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    
    // 验证图片尺寸
    const img = new window.Image();
    img.onload = async () => {
      const ratio = img.width / img.height;
      const expectedRatio = 9 / 16;
      const tolerance = 0.1; // 10% 容差
      
      if (Math.abs(ratio - expectedRatio) > tolerance) {
        toast.warning(`图片比例为 ${img.width}:${img.height}，建议使用 9:16 比例的图片以获得最佳效果`);
      }
      
      // 转换为 base64 并上传
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await uploadMutation.mutateAsync({
            imageBase64: base64,
            mimeType: file.type,
            fileName: file.name,
          });
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        setIsUploading(false);
        toast.error("图片上传失败");
      }
    };
    img.src = localPreview;
    
    // 清空 input 以便重复选择同一文件
    event.target.value = '';
  };
  
  // 触发文件选择
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  // 清除图片 - P0欢迎页
  const clearImage = () => {
    setIpImageUrl("");
    setPreviewUrl(null);
    setHasChanges(true);
  };

  // 处理文件选择 - 摄像头权限提醒
  const handleCameraPermissionFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("请选择图片文件");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片大小不能超过 2MB");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setCameraPermissionPreviewUrl(localPreview);

    const img = new window.Image();
    img.onload = async () => {
      const ratio = img.width / img.height;
      const expectedRatio = 9 / 16;
      const tolerance = 0.1;

      if (Math.abs(ratio - expectedRatio) > tolerance) {
        toast.warning(`图片比例为 ${img.width}:${img.height}，建议使用 9:16 比例的图片以获得最佳效果`);
      }

      setIsCameraPermissionUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await uploadCameraPermissionMutation.mutateAsync({
            imageBase64: base64,
            mimeType: file.type,
            fileName: file.name,
          });
          setIsCameraPermissionUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        setIsCameraPermissionUploading(false);
        toast.error("图片上传失败");
      }
    };
    img.src = localPreview;

    event.target.value = '';
  };

  // 触发文件选择 - 摄像头权限提醒
  const triggerCameraPermissionFileSelect = () => {
    cameraPermissionFileInputRef.current?.click();
  };

  // 清除图片 - 摄像头权限提醒
  const clearCameraPermissionImage = () => {
    setCameraPermissionImageUrl("");
    setCameraPermissionPreviewUrl(null);
    setCameraPermissionHasChanges(true);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AdminLayout>
    );
  }

  // 显示的图片 URL（优先显示本地预览，其次是已保存的 URL）
  const displayImageUrl = previewUrl || ipImageUrl;
  const displayCameraPermissionImageUrl = cameraPermissionPreviewUrl || cameraPermissionImageUrl;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Image className="h-5 w-5" />
              IP形象配置
            </h1>
            <p className="text-sm text-muted-foreground">
              配置小程序欢迎页（P0）的IP形象图片
            </p>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || saveConfigMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveConfigMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>

        {/* 提示信息 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">IP形象配置说明</p>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>IP形象图片将在小程序欢迎页（P0）全屏显示</li>
                  <li>建议图片比例为 <strong>9:16</strong>（竖屏），如 1080x1920 像素</li>
                  <li>支持 JPG、PNG 格式，建议文件大小不超过 2MB</li>
                  <li>图片将自动适配不同手机屏幕尺寸</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 配置表单 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 左侧：上传区域 */}
          <Card>
            <CardHeader>
              <CardTitle>图片上传</CardTitle>
              <CardDescription>点击下方区域上传IP形象图片</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {/* 上传区域 */}
              <div 
                onClick={triggerFileSelect}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 
                  transition-colors cursor-pointer
                  ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-primary hover:bg-primary/5'}
                `}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-3" />
                    <p className="text-sm text-muted-foreground">上传中...</p>
                  </div>
                ) : displayImageUrl ? (
                  <div className="relative">
                    <img 
                      src={displayImageUrl} 
                      alt="IP形象预览" 
                      className="max-h-48 mx-auto rounded-lg object-contain"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearImage();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-3">
                      点击重新上传
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm font-medium text-gray-600">点击上传图片</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      支持 JPG、PNG 格式，最大 2MB
                    </p>
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">图片规格要求：</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 p-2 rounded">
                    <span className="text-muted-foreground">比例：</span>
                    <span className="font-medium ml-1">9:16</span>
                  </div>
                  <div className="bg-muted/50 p-2 rounded">
                    <span className="text-muted-foreground">建议尺寸：</span>
                    <span className="font-medium ml-1">1080x1920</span>
                  </div>
                  <div className="bg-muted/50 p-2 rounded">
                    <span className="text-muted-foreground">格式：</span>
                    <span className="font-medium ml-1">JPG/PNG</span>
                  </div>
                  <div className="bg-muted/50 p-2 rounded">
                    <span className="text-muted-foreground">大小：</span>
                    <span className="font-medium ml-1">≤2MB</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 右侧：预览区域 */}
          <Card>
            <CardHeader>
              <CardTitle>效果预览</CardTitle>
              <CardDescription>模拟手机屏幕显示效果</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                {/* 手机模拟框 */}
                <div className="relative w-[200px] h-[356px] bg-black rounded-[24px] p-2 shadow-xl">
                  {/* 刘海 */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
                  
                  {/* 屏幕内容 */}
                  <div className="w-full h-full bg-gray-100 rounded-[16px] overflow-hidden">
                    {displayImageUrl ? (
                      <img
                        src={displayImageUrl}
                        alt="IP形象预览"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "";
                          (e.target as HTMLImageElement).alt = "图片加载失败";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <Image className="h-12 w-12 mb-2" />
                        <span className="text-xs">暂无图片</span>
                        <span className="text-xs">请上传图片</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {displayImageUrl && (
                <p className="text-center text-xs text-muted-foreground mt-4">
                  此预览仅供参考，实际效果以手机端为准
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 分割线 */}
        <div className="border-t border-gray-200 my-8" />

        {/* 摄像头权限提醒图片配置 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Image className="h-5 w-5" />
                摄像头权限提醒图片
              </h2>
              <p className="text-sm text-muted-foreground">
                配置Page4摄像头权限提醒页面的全屏图片
              </p>
            </div>
            <Button
              onClick={handleSaveCameraPermission}
              disabled={!cameraPermissionHasChanges || saveCameraPermissionConfigMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveCameraPermissionConfigMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>

          {/* 提示信息 */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">摄像头权限提醒图片说明</p>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    <li>当用户拒绝摄像头权限后，点击拍照按钮会跳转到此提醒页面</li>
                    <li>用户点击该页面任意位置将打开系统设置页</li>
                    <li>建议图片比例为 <strong>9:16</strong>（竖屏），如 1080x1920 像素</li>
                    <li>图片内容应引导用户开启摄像头权限</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 配置表单 */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* 左侧：上传区域 */}
            <Card>
              <CardHeader>
                <CardTitle>图片上传</CardTitle>
                <CardDescription>点击下方区域上传摄像头权限提醒图片</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 隐藏的文件输入 */}
                <input
                  ref={cameraPermissionFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCameraPermissionFileSelect}
                  className="hidden"
                />

                {/* 上传区域 */}
                <div
                  onClick={triggerCameraPermissionFileSelect}
                  className={`
                    relative border-2 border-dashed rounded-lg p-8
                    transition-colors cursor-pointer
                    ${isCameraPermissionUploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-primary hover:bg-primary/5'}
                  `}
                >
                  {isCameraPermissionUploading ? (
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="h-12 w-12 text-primary animate-spin mb-3" />
                      <p className="text-sm text-muted-foreground">上传中...</p>
                    </div>
                  ) : displayCameraPermissionImageUrl ? (
                    <div className="relative">
                      <img
                        src={displayCameraPermissionImageUrl}
                        alt="摄像头权限提醒预览"
                        className="max-h-48 mx-auto rounded-lg object-contain"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearCameraPermissionImage();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <p className="text-center text-xs text-muted-foreground mt-3">
                        点击重新上传
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <Upload className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-600">点击上传图片</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        支持 JPG、PNG 格式，最大 2MB
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">图片规格要求：</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">比例：</span>
                      <span className="font-medium ml-1">9:16</span>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">建议尺寸：</span>
                      <span className="font-medium ml-1">1080x1920</span>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">格式：</span>
                      <span className="font-medium ml-1">JPG/PNG</span>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">大小：</span>
                      <span className="font-medium ml-1">≤2MB</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 右侧：预览区域 */}
            <Card>
              <CardHeader>
                <CardTitle>效果预览</CardTitle>
                <CardDescription>模拟手机屏幕显示效果</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  {/* 手机模拟框 */}
                  <div className="relative w-[200px] h-[356px] bg-black rounded-[24px] p-2 shadow-xl">
                    {/* 刘海 */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />

                    {/* 屏幕内容 */}
                    <div className="w-full h-full bg-gray-100 rounded-[16px] overflow-hidden">
                      {displayCameraPermissionImageUrl ? (
                        <img
                          src={displayCameraPermissionImageUrl}
                          alt="摄像头权限提醒预览"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "";
                            (e.target as HTMLImageElement).alt = "图片加载失败";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <Image className="h-12 w-12 mb-2" />
                          <span className="text-xs">暂无图片</span>
                          <span className="text-xs">请上传图片</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {displayCameraPermissionImageUrl && (
                  <p className="text-center text-xs text-muted-foreground mt-4">
                    此预览仅供参考，实际效果以手机端为准
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
