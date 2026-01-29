import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save, MapPin, Bot, User, Users, Eye, EyeOff, CheckCircle, XCircle, Loader2, CreditCard } from "lucide-react";

// API配置项定义
const API_CONFIG_GROUPS = [
  {
    title: "腾讯位置服务",
    description: "用于景点经纬度查询和地图服务",
    icon: MapPin,
    items: [
      {
        key: "TENCENT_MAP_API_KEY",
        label: "API Key",
        description: "腾讯位置服务API密钥，在腾讯位置服务控制台获取",
        placeholder: "如：XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
        sensitive: true,
      },
    ],
  },
  {
    title: "Coze API 配置",
    description: "Coze平台API密钥和智能体配置，所有工作流共用",
    icon: Bot,
    items: [
      {
        key: "COZE_API_KEY",
        label: "API Key (Personal Access Token)",
        description: "Coze平台的Personal Access Token，在Coze控制台获取",
        placeholder: "如：sat_xxxxxxxxxxxxxxxxxxxxxxxxxx",
        sensitive: true,
      },
      {
        key: "COZE_BOT_ID",
        label: "智能体ID (Bot ID)",
        description: "关联的智能体ID，某些工作流需要（如包含数据库节点、变量节点）。在智能体开发页面URL中获取，如 bot/73428668***** 中的数字",
        placeholder: "如：7342866812345678901",
        sensitive: false,
      },
    ],
  },
  {
    title: "单人换脸工作流",
    description: "用于单人照片的AI换脸处理",
    icon: User,
    items: [
      {
        key: "COZE_SINGLE_FACE_WORKFLOW_ID",
        label: "工作流ID",
        description: "在Coze控制台获取单人换脸工作流的ID",
        placeholder: "如：7578419604687552562",
        sensitive: false,
      },
    ],
  },
  {
    title: "双人换脸工作流",
    description: "用于双人/合照的AI换脸处理",
    icon: Users,
    items: [
      {
        key: "COZE_DOUBLE_FACE_WORKFLOW_ID",
        label: "工作流ID",
        description: "在Coze控制台获取双人换脸工作流的ID",
        placeholder: "如：7574050703116075050",
        sensitive: false,
      },
    ],
  },
  {
    title: "AI用户判别工作流",
    description: "用于分析用户自拍照的脸型、性别、年龄段等信息",
    icon: Bot,
    items: [
      {
        key: "COZE_USER_ANALYZE_WORKFLOW_ID",
        label: "工作流ID",
        description: "在Coze控制台获取用户判别工作流的ID",
        placeholder: "如：7554026919391150095",
        sensitive: false,
      },
    ],
  },
  {
    title: "微信支付配置",
    description: "微信支付JSAPI v3接口配置，用于小程序内支付",
    icon: CreditCard,
    items: [
      {
        key: "WECHAT_APP_ID",
        label: "小程序 AppID",
        description: "微信小程序的AppID，在微信公众平台获取",
        placeholder: "如：wx1234567890abcdef",
        sensitive: false,
      },
      {
        key: "WECHAT_MCH_ID",
        label: "商户号",
        description: "微信支付商户号，在微信支付商户平台获取",
        placeholder: "如：1234567890",
        sensitive: false,
      },
      {
        key: "WECHAT_API_KEY",
        label: "API 密钥 (v2)",
        description: "微信支付API密钥v2版本，在商户平台 - API安全 中设置",
        placeholder: "32位密钥字符串",
        sensitive: true,
      },
      {
        key: "WECHAT_API_V3_KEY",
        label: "API v3 密钥",
        description: "微信支付API v3密钥，在商户平台 - API安全 中设置，用于解密回调数据",
        placeholder: "32位密钥字符串",
        sensitive: true,
      },
      {
        key: "WECHAT_SERIAL_NO",
        label: "商户证书序列号",
        description: "商户API证书的序列号，在商户平台 - API安全 - API证书 中查看",
        placeholder: "如：1234567890ABCDEF1234567890ABCDEF12345678",
        sensitive: false,
      },
      {
        key: "WECHAT_PRIVATE_KEY",
        label: "商户私钥",
        description: "商户API证书的私钥内容，申请证书时生成的apiclient_key.pem文件内容",
        placeholder: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
        sensitive: true,
        multiline: true,
      },
      {
        key: "WECHAT_PAY_NOTIFY_URL",
        label: "支付回调地址",
        description: "微信支付结果通知回调地址，必须是HTTPS公网地址",
        placeholder: "如：https://your-domain.com/api/wechat/pay/notify",
        sensitive: false,
      },
    ],
  },
];

export default function ApiConfig() {
  const utils = trpc.useUtils();
  
  // 查询现有配置
  const { data: configs = [], isLoading } = trpc.admin.systemConfigs.useQuery();
  
  // 本地表单状态
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'loading' | null>>({});
  
  // 初始化表单数据
  useEffect(() => {
    const initialData: Record<string, string> = {};
    API_CONFIG_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        const existingConfig = configs.find((c) => c.configKey === item.key);
        initialData[item.key] = existingConfig?.configValue || "";
      });
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
  
  // 测试API连接
  const testApiMutation = trpc.admin.testApiConnection.useMutation();
  
  // 更新单个参数
  const updateParam = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
    // 清除测试结果
    setTestResults((prev) => ({
      ...prev,
      [key]: null,
    }));
  };
  
  // 切换敏感信息显示
  const toggleSensitive = (key: string) => {
    setShowSensitive((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };
  
  // 测试单个API
  const handleTestApi = async (key: string) => {
    setTestResults((prev) => ({
      ...prev,
      [key]: 'loading',
    }));
    
    try {
      const result = await testApiMutation.mutateAsync({
        configKey: key,
        configValue: formData[key] || "",
      });
      
      setTestResults((prev) => ({
        ...prev,
        [key]: result.success ? 'success' : 'error',
      }));
      
      if (result.success) {
        toast.success(result.message || "连接测试成功");
      } else {
        toast.error(result.message || "连接测试失败");
      }
    } catch (error: any) {
      setTestResults((prev) => ({
        ...prev,
        [key]: 'error',
      }));
      toast.error(error.message || "测试失败");
    }
  };
  
  // 保存所有配置
  const handleSaveAll = async () => {
    try {
      const allItems = API_CONFIG_GROUPS.flatMap((group) => group.items);
      const promises = allItems.map((item) => {
        const value = formData[item.key];
        return saveConfigMutation.mutateAsync({
          key: item.key,
          value: value || "",
          description: item.description,
        });
      });
      
      await Promise.all(promises);
      toast.success("API配置保存成功");
      setHasChanges(false);
    } catch (error) {
      toast.error("保存失败，请重试");
    }
  };
  
  // 获取测试结果图标
  const getTestResultIcon = (key: string) => {
    const result = testResults[key];
    if (result === 'loading') {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (result === 'success') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (result === 'error') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
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
              API配置管理
            </h1>
            <p className="text-sm text-muted-foreground">
              配置第三方API服务的密钥和工作流ID
            </p>
          </div>
          <Button onClick={handleSaveAll} disabled={!hasChanges || saveConfigMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveConfigMutation.isPending ? "保存中..." : "保存全部"}
          </Button>
        </div>

        {/* 配置表单 */}
        {API_CONFIG_GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {group.title}
                </CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {group.items.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <Label htmlFor={item.key} className="flex items-center gap-2">
                      {item.label}
                      {getTestResultIcon(item.key)}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 max-w-xl">
                        {'multiline' in item && item.multiline ? (
                          // 多行输入框（用于私钥等长文本）
                          <>
                            <Textarea
                              id={item.key}
                              value={item.sensitive && !showSensitive[item.key]
                                ? (formData[item.key] ? '••••••••••••••••••••' : '')
                                : (formData[item.key] || "")}
                              onChange={(e) => {
                                // 如果是隐藏状态且用户开始输入，自动显示
                                if (item.sensitive && !showSensitive[item.key]) {
                                  setShowSensitive(prev => ({ ...prev, [item.key]: true }));
                                }
                                updateParam(item.key, e.target.value);
                              }}
                              placeholder={item.placeholder}
                              rows={4}
                              className="font-mono text-xs resize-y"
                              readOnly={item.sensitive && !showSensitive[item.key] && !!formData[item.key]}
                              onClick={() => {
                                if (item.sensitive && !showSensitive[item.key] && formData[item.key]) {
                                  setShowSensitive(prev => ({ ...prev, [item.key]: true }));
                                }
                              }}
                            />
                            {item.sensitive && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1 h-7 w-7 p-0"
                                onClick={() => toggleSensitive(item.key)}
                              >
                                {showSensitive[item.key] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </>
                        ) : (
                          // 单行输入框
                          <>
                            <Input
                              id={item.key}
                              type={item.sensitive && !showSensitive[item.key] ? "password" : "text"}
                              value={formData[item.key] || ""}
                              onChange={(e) => updateParam(item.key, e.target.value)}
                              placeholder={item.placeholder}
                              className="pr-10"
                            />
                            {item.sensitive && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                                onClick={() => toggleSensitive(item.key)}
                              >
                                {showSensitive[item.key] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestApi(item.key)}
                        disabled={!formData[item.key] || testResults[item.key] === 'loading'}
                        className={'multiline' in item && item.multiline ? 'self-start' : ''}
                      >
                        {testResults[item.key] === 'loading' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "测试"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {/* 配置说明 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="text-sm text-blue-700 space-y-2">
              <p className="font-medium">配置说明</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>腾讯位置服务</strong>：用于在管理后台配置景点时自动获取经纬度</li>
                <li><strong>Coze API Key</strong>：所有Coze工作流共用一个API密钥</li>
                <li><strong>单人换脸工作流</strong>：处理单人照片的AI换脸</li>
                <li><strong>双人换脸工作流</strong>：处理双人/合照的AI换脸</li>
                <li><strong>AI用户判别工作流</strong>：分析用户自拍照，识别脸型、性别、年龄段</li>
                <li><strong>微信支付配置</strong>：小程序内购买积分和付费模板的支付功能</li>
                <li>点击"测试"按钮可验证配置是否正确</li>
                <li>修改后请点击"保存全部"按钮使配置生效</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
