import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save, Phone, Info } from "lucide-react";

// 系统参数配置项
const SYSTEM_PARAMS = [
  {
    key: "customer_service_phone",
    label: "客服电话",
    description: "用于生成失败时显示的联系方式",
    placeholder: "如：18600000000",
    icon: Phone,
  },
];

export default function SystemParams() {
  const utils = trpc.useUtils();
  
  // 查询现有配置
  const { data: configs = [], isLoading } = trpc.admin.systemConfigs.useQuery();
  
  // 本地表单状态
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // 初始化表单数据
  useEffect(() => {
    const initialData: Record<string, string> = {};
    SYSTEM_PARAMS.forEach((param) => {
      const existingConfig = configs.find((c) => c.configKey === param.key);
      initialData[param.key] = existingConfig?.configValue || "";
    });
    setFormData(initialData);
  }, [configs]);
  
  // 保存配置
  const saveConfigMutation = trpc.admin.saveSystemConfig.useMutation({
    onSuccess: () => {
      utils.admin.systemConfigs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // 更新单个参数
  const updateParam = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };
  
  // 保存所有配置
  const handleSaveAll = async () => {
    try {
      const promises = SYSTEM_PARAMS.map((param) => {
        const value = formData[param.key];
        return saveConfigMutation.mutateAsync({
          key: param.key,
          value: value || "",
          description: param.description,
        });
      });
      
      await Promise.all(promises);
      toast.success("系统参数保存成功");
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
              <Settings className="h-5 w-5" />
              系统参数配置
            </h1>
            <p className="text-sm text-muted-foreground">
              配置系统运行所需的基础参数
            </p>
          </div>
          <Button onClick={handleSaveAll} disabled={!hasChanges || saveConfigMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveConfigMutation.isPending ? "保存中..." : "保存全部"}
          </Button>
        </div>

        {/* 配置表单 */}
        <Card>
          <CardHeader>
            <CardTitle>基础参数</CardTitle>
            <CardDescription>配置系统运行所需的基础信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {SYSTEM_PARAMS.map((param) => {
              const Icon = param.icon;
              return (
                <div key={param.key} className="space-y-2">
                  <Label htmlFor={param.key} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {param.label}
                  </Label>
                  <Input
                    id={param.key}
                    value={formData[param.key] || ""}
                    onChange={(e) => updateParam(param.key, e.target.value)}
                    placeholder={param.placeholder}
                    className="max-w-md"
                  />
                  <p className="text-xs text-muted-foreground">{param.description}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 提示信息 */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-medium">配置说明</p>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>客服电话将在照片生成失败时展示给用户</li>
                  <li>请确保填写正确的联系方式，以便用户能够及时获得帮助</li>
                  <li>修改后请点击"保存全部"按钮使配置生效</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
