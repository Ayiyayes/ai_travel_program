import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Share2, Image, Save, Info } from "lucide-react";

// 分享场景配置
const SHARE_SCENES = [
  {
    pageCode: "P1",
    pageName: "模板选择页",
    description: "用户在首页浏览模板时分享",
    defaultTitle: "我正在拍写真，也请你免费拍一张",
  },
  {
    pageCode: "P2",
    pageName: "模板详情页",
    description: "用户查看单个模板详情时分享",
    defaultTitle: "快来看看这个超美的模板",
  },
  {
    pageCode: "P5",
    pageName: "单照片生成完成",
    description: "用户生成单张照片后分享，支持动态变量 {景点名}",
    defaultTitle: "给你看看我在{景点名}拍的美照",
  },
  {
    pageCode: "P6",
    pageName: "付费模板选择页",
    description: "用户选择付费模板时分享",
    defaultTitle: "发现了超多精美模板，一起来看看",
  },
  {
    pageCode: "P7",
    pageName: "多照片生成完成",
    description: "用户生成多张照片后分享",
    defaultTitle: "我的旅拍写真集完成啦",
  },
  {
    pageCode: "P8",
    pageName: "全屏照片查看",
    description: "用户全屏查看照片时分享",
    defaultTitle: "看看我的旅拍美照",
  },
];

export default function ShareConfig() {
  const utils = trpc.useUtils();
  
  // 查询现有配置
  const { data: shareConfigs = [], isLoading } = trpc.admin.shareConfigs.useQuery();
  
  // 本地表单状态
  const [formData, setFormData] = useState<Record<string, { title: string; coverUrl: string; description: string }>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // 初始化表单数据
  useEffect(() => {
    const initialData: Record<string, { title: string; coverUrl: string; description: string }> = {};
    
    SHARE_SCENES.forEach((scene) => {
      const existingConfig = shareConfigs.find((c) => c.pageCode === scene.pageCode);
      initialData[scene.pageCode] = {
        title: existingConfig?.title || scene.defaultTitle,
        coverUrl: existingConfig?.coverUrl || "",
        description: existingConfig?.description || "",
      };
    });
    
    setFormData(initialData);
  }, [shareConfigs]);
  
  // 保存配置
  const saveConfigMutation = trpc.admin.saveShareConfig.useMutation({
    onSuccess: () => {
      utils.admin.shareConfigs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // 更新单个场景的配置
  const updateSceneConfig = (pageCode: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [pageCode]: {
        ...prev[pageCode],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };
  
  // 保存所有配置
  const handleSaveAll = async () => {
    try {
      const promises = SHARE_SCENES.map((scene) => {
        const config = formData[scene.pageCode];
        if (config) {
          return saveConfigMutation.mutateAsync({
            pageCode: scene.pageCode,
            pageName: scene.pageName,
            title: config.title || undefined,
            coverUrl: config.coverUrl || undefined,
            description: config.description || undefined,
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(promises);
      toast.success("分享配置保存成功");
      setHasChanges(false);
    } catch (error) {
      toast.error("保存失败，请重试");
    }
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

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              分享配置
            </h1>
            <p className="text-sm text-muted-foreground">
              配置不同页面的分享标题和封面图，提升小程序传播效果
            </p>
          </div>
          <Button onClick={handleSaveAll} disabled={!hasChanges || saveConfigMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveConfigMutation.isPending ? "保存中..." : "保存全部"}
          </Button>
        </div>

        {/* 提示信息 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">分享配置说明</p>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>如果不设置封面图，将默认分享当前页面的内容截图</li>
                  <li>标题支持动态变量，如 <code className="bg-blue-100 px-1 rounded">{"{景点名}"}</code> 会自动替换为实际景点名称</li>
                  <li>建议封面图尺寸为 500x400 像素，支持 JPG/PNG 格式</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 分享场景配置列表 */}
        <div className="grid gap-4">
          {SHARE_SCENES.map((scene) => (
            <Card key={scene.pageCode}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-mono">
                        {scene.pageCode}
                      </span>
                      {scene.pageName}
                    </CardTitle>
                    <CardDescription className="mt-1">{scene.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`title-${scene.pageCode}`}>分享标题</Label>
                    <Input
                      id={`title-${scene.pageCode}`}
                      value={formData[scene.pageCode]?.title || ""}
                      onChange={(e) => updateSceneConfig(scene.pageCode, "title", e.target.value)}
                      placeholder={scene.defaultTitle}
                    />
                    <p className="text-xs text-muted-foreground">
                      默认：{scene.defaultTitle}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`cover-${scene.pageCode}`}>封面图URL（可选）</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`cover-${scene.pageCode}`}
                        value={formData[scene.pageCode]?.coverUrl || ""}
                        onChange={(e) => updateSceneConfig(scene.pageCode, "coverUrl", e.target.value)}
                        placeholder="https://example.com/cover.jpg"
                      />
                      {formData[scene.pageCode]?.coverUrl && (
                        <div className="w-10 h-10 rounded border overflow-hidden flex-shrink-0">
                          <img
                            src={formData[scene.pageCode].coverUrl}
                            alt="封面预览"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      留空则使用当前页面截图作为封面
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 底部保存按钮 */}
        {hasChanges && (
          <div className="sticky bottom-4 flex justify-center">
            <Button 
              onClick={handleSaveAll} 
              disabled={saveConfigMutation.isPending}
              size="lg"
              className="shadow-lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveConfigMutation.isPending ? "保存中..." : "保存全部配置"}
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
