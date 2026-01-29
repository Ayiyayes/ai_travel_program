import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { pinyin } from "pinyin-pro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, Building2, Loader2, Search } from "lucide-react";

export default function CitySpots() {
  
  const utils = trpc.useUtils();
  
  // 城市相关状态
  const [cityDialogOpen, setCityDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<any>(null);
  const [cityForm, setCityForm] = useState({ name: "", pinyin: "" });
  
  // 城市名称变化时自动生成拼音
  const handleCityNameChange = (name: string) => {
    const pinyinStr = pinyin(name, { toneType: "none", type: "array" }).join("").toLowerCase();
    setCityForm({ name, pinyin: pinyinStr });
  };
  
  // 景点相关状态
  const [spotDialogOpen, setSpotDialogOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<any>(null);
  const [spotForm, setSpotForm] = useState({ 
    name: "", 
    cityId: 0, 
    latitude: "", 
    longitude: "" 
  });
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("all");
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  
  // 腾讯地图 API 查询经纬度
  const searchLocationMutation = trpc.map.searchLocation.useMutation({
    onSuccess: (data) => {
      if (data.success && data.location) {
        setSpotForm(prev => ({
          ...prev,
          latitude: data.location!.lat.toFixed(6),
          longitude: data.location!.lng.toFixed(6)
        }));
        toast.success(`经纬度获取成功: ${data.title}`);
      } else {
        toast.error(data.message || "未找到该景点的经纬度");
      }
    },
    onError: (error) => {
      toast.error(error.message || "获取经纬度失败");
    },
  });
  
  // 自动获取景点经纬度
  const searchSpotLocation = async () => {
    if (!spotForm.name || !spotForm.cityId) {
      toast.error("请先填写景点名称并选择城市");
      return;
    }
    
    const city = cities.find(c => c.id === spotForm.cityId);
    if (!city) {
      toast.error("请选择城市");
      return;
    }
    
    setIsSearchingLocation(true);
    try {
      // 使用腾讯地图 API 获取经纬度
      await searchLocationMutation.mutateAsync({
        keyword: spotForm.name,
        city: city.name,
      });
    } finally {
      setIsSearchingLocation(false);
    }
  };
  
  // 查询数据
  const { data: cities = [], isLoading: citiesLoading } = trpc.admin.cities.useQuery();
  const { data: spots = [], isLoading: spotsLoading } = trpc.admin.spots.useQuery(
    selectedCityFilter !== "all" ? { cityId: parseInt(selectedCityFilter) } : undefined
  );
  
  // 城市操作
  const createCityMutation = trpc.admin.createCity.useMutation({
    onSuccess: () => {
      toast.success("城市创建成功");
      utils.admin.cities.invalidate();
      setCityDialogOpen(false);
      setCityForm({ name: "", pinyin: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const updateCityMutation = trpc.admin.updateCity.useMutation({
    onSuccess: () => {
      toast.success("城市更新成功");
      utils.admin.cities.invalidate();
      setCityDialogOpen(false);
      setEditingCity(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const deleteCityMutation = trpc.admin.deleteCity.useMutation({
    onSuccess: () => {
      toast.success("城市删除成功");
      utils.admin.cities.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // 景点操作
  const createSpotMutation = trpc.admin.createSpot.useMutation({
    onSuccess: () => {
      toast.success("景点创建成功");
      utils.admin.spots.invalidate();
      setSpotDialogOpen(false);
      setSpotForm({ name: "", cityId: 0, latitude: "", longitude: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const updateSpotMutation = trpc.admin.updateSpot.useMutation({
    onSuccess: () => {
      toast.success("景点更新成功");
      utils.admin.spots.invalidate();
      setSpotDialogOpen(false);
      setEditingSpot(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const deleteSpotMutation = trpc.admin.deleteSpot.useMutation({
    onSuccess: () => {
      toast.success("景点删除成功");
      utils.admin.spots.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // 城市表单处理
  const handleCitySubmit = () => {
    if (editingCity) {
      updateCityMutation.mutate({
        id: editingCity.id,
        name: cityForm.name,
        pinyin: cityForm.pinyin,
      });
    } else {
      createCityMutation.mutate(cityForm);
    }
  };
  
  const openEditCity = (city: any) => {
    setEditingCity(city);
    setCityForm({ name: city.name, pinyin: city.pinyin });
    setCityDialogOpen(true);
  };
  
  const openNewCity = () => {
    setEditingCity(null);
    setCityForm({ name: "", pinyin: "" });
    setCityDialogOpen(true);
  };
  
  // 景点表单处理
  const handleSpotSubmit = () => {
    if (editingSpot) {
      updateSpotMutation.mutate({
        id: editingSpot.id,
        name: spotForm.name,
        cityId: spotForm.cityId,
        latitude: spotForm.latitude || undefined,
        longitude: spotForm.longitude || undefined,
      });
    } else {
      createSpotMutation.mutate({
        name: spotForm.name,
        cityId: spotForm.cityId,
        latitude: spotForm.latitude || undefined,
        longitude: spotForm.longitude || undefined,
      });
    }
  };
  
  const openEditSpot = (spot: any) => {
    setEditingSpot(spot);
    setSpotForm({
      name: spot.name,
      cityId: spot.cityId,
      latitude: spot.latitude || "",
      longitude: spot.longitude || "",
    });
    setSpotDialogOpen(true);
  };
  
  const openNewSpot = () => {
    setEditingSpot(null);
    setSpotForm({ 
      name: "", 
      cityId: cities.length > 0 ? cities[0].id : 0, 
      latitude: "", 
      longitude: "" 
    });
    setSpotDialogOpen(true);
  };
  
  // 切换城市状态
  const toggleCityStatus = (city: any) => {
    updateCityMutation.mutate({
      id: city.id,
      isActive: !city.isActive,
    });
  };
  
  // 切换景点状态
  const toggleSpotStatus = (spot: any) => {
    updateSpotMutation.mutate({
      id: spot.id,
      isActive: !spot.isActive,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">城市景点管理</h1>
            <p className="text-sm text-muted-foreground">管理城市和景点信息</p>
          </div>
        </div>

        {/* 城市管理 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              城市列表
              <Badge variant="secondary">{cities.length} 个城市</Badge>
            </CardTitle>
            <Button onClick={openNewCity} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新增城市
            </Button>
          </CardHeader>
          <CardContent>
            {citiesLoading ? (
              <div className="text-center py-4 text-muted-foreground">加载中...</div>
            ) : cities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无城市数据，请点击"新增城市"添加
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {cities.map((city) => (
                  <div
                    key={city.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{city.name}</span>
                      <span className="text-xs text-muted-foreground">({city.pinyin})</span>
                      {!city.isActive && (
                        <Badge variant="outline" className="text-xs">禁用</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditCity(city)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("确定要删除这个城市吗？")) {
                            deleteCityMutation.mutate({ id: city.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 景点管理 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                景点列表
                <Badge variant="secondary">{spots.length} 个景点</Badge>
              </CardTitle>
              <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="筛选城市" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部城市</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id.toString()}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openNewSpot} size="sm" disabled={cities.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              新增景点
            </Button>
          </CardHeader>
          <CardContent>
            {spotsLoading ? (
              <div className="text-center py-4 text-muted-foreground">加载中...</div>
            ) : spots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {cities.length === 0 
                  ? "请先添加城市，然后再添加景点" 
                  : "暂无景点数据，请点击「新增景点」添加"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">景点名称</th>
                      <th className="text-left py-3 px-4 font-medium">所属城市</th>
                      <th className="text-left py-3 px-4 font-medium">经纬度</th>
                      <th className="text-left py-3 px-4 font-medium">状态</th>
                      <th className="text-left py-3 px-4 font-medium">添加时间</th>
                      <th className="text-right py-3 px-4 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spots.map((spot) => (
                      <tr key={spot.id} className="border-b hover:bg-accent/50">
                        <td className="py-3 px-4 font-medium">{spot.name}</td>
                        <td className="py-3 px-4">{spot.cityName || "-"}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {spot.latitude && spot.longitude 
                            ? `${spot.latitude}, ${spot.longitude}` 
                            : "未设置"}
                        </td>
                        <td className="py-3 px-4">
                          <Switch
                            checked={spot.isActive}
                            onCheckedChange={() => toggleSpotStatus(spot)}
                          />
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(spot.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditSpot(spot)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("确定要删除这个景点吗？")) {
                                deleteSpotMutation.mutate({ id: spot.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 城市编辑对话框 */}
        <Dialog open={cityDialogOpen} onOpenChange={setCityDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCity ? "编辑城市" : "新增城市"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cityName">城市名称</Label>
                <Input
                  id="cityName"
                  value={cityForm.name}
                  onChange={(e) => handleCityNameChange(e.target.value)}
                  placeholder="如：长沙"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cityPinyin">拼音（自动生成，用于排序）</Label>
                <Input
                  id="cityPinyin"
                  value={cityForm.pinyin}
                  onChange={(e) => setCityForm({ ...cityForm, pinyin: e.target.value })}
                  placeholder="输入城市名称后自动生成"
                  className="bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">拼音会根据城市名称自动生成，也可手动修改</p>
              </div>
              {editingCity && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="cityStatus">启用状态</Label>
                  <Switch
                    id="cityStatus"
                    checked={editingCity.isActive}
                    onCheckedChange={(checked) => {
                      setEditingCity({ ...editingCity, isActive: checked });
                    }}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCityDialogOpen(false)}>
                取消
              </Button>
              <Button 
                onClick={handleCitySubmit}
                disabled={!cityForm.name || !cityForm.pinyin}
              >
                {editingCity ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 景点编辑对话框 */}
        <Dialog open={spotDialogOpen} onOpenChange={setSpotDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSpot ? "编辑景点" : "新增景点"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="spotName">景点名称</Label>
                <Input
                  id="spotName"
                  value={spotForm.name}
                  onChange={(e) => setSpotForm({ ...spotForm, name: e.target.value })}
                  placeholder="如：橘子洲"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spotCity">所属城市</Label>
                <Select 
                  value={spotForm.cityId.toString()} 
                  onValueChange={(v) => setSpotForm({ ...spotForm, cityId: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择城市" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id.toString()}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>经纬度 <span className="text-destructive">*</span></Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={searchSpotLocation}
                    disabled={isSearchingLocation || !spotForm.name || !spotForm.cityId}
                  >
                    {isSearchingLocation ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" />查询中...</>
                    ) : (
                      <><Search className="h-3 w-3 mr-1" />自动获取</>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="spotLat" className="text-xs text-muted-foreground">纬度</Label>
                    <Input
                      id="spotLat"
                      value={spotForm.latitude}
                      onChange={(e) => setSpotForm({ ...spotForm, latitude: e.target.value })}
                      placeholder="如：28.1936"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="spotLng" className="text-xs text-muted-foreground">经度</Label>
                    <Input
                      id="spotLng"
                      value={spotForm.longitude}
                      onChange={(e) => setSpotForm({ ...spotForm, longitude: e.target.value })}
                      placeholder="如：112.9822"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  点击“自动获取”根据景点名称和城市自动查询经纬度，也可手动输入
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSpotDialogOpen(false)}>
                取消
              </Button>
              <Button 
                onClick={handleSpotSubmit}
                disabled={!spotForm.name || !spotForm.cityId || !spotForm.latitude || !spotForm.longitude}
              >
                {editingSpot ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
