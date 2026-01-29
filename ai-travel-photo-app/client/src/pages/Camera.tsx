import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { ChevronLeft, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLoginUrl } from '@/const';

type CameraMode = 'capture' | 'preview';

export default function CameraPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, isAuthenticated } = useAuth();
  
  const [mode, setMode] = useState<CameraMode>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [faceAnalysisResult, setFaceAnalysisResult] = useState<{
    faceType?: string;
    gender?: string;
    userType?: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializingRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // 解析 URL 参数获取选中的模板
  const templateIds = new URLSearchParams(searchString).get('templates')?.split(',').map(Number).filter(Boolean) || [];

  // 上传自拍照
  const uploadMutation = trpc.photo.uploadSelfie.useMutation();
  
  // 创建换脸任务
  const createPhotoMutation = trpc.photo.createSingle.useMutation();
  
  // AI 用户判别
  const analyzeUserMutation = trpc.photo.analyzeUser.useMutation();

  // 停止相机
  const stopCamera = useCallback(() => {
    // 等待任何正在进行的 play() 完成
    if (playPromiseRef.current) {
      playPromiseRef.current.then(() => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }).catch(() => {
        // 忽略错误
      });
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraReady(false);
    initializingRef.current = false;
    playPromiseRef.current = null;
  }, []);

  // 初始化相机
  const initCamera = useCallback(async () => {
    // 防止重复初始化
    if (initializingRef.current) {
      return;
    }
    
    initializingRef.current = true;
    setIsCameraReady(false);
    setError(null);
    
    try {
      // 先停止现有的流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // 如果有正在进行的 play()，等待它完成
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current;
        } catch {
          // 忽略之前的 play 错误
        }
        playPromiseRef.current = null;
      }
      
      // 暂停并清除视频源
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      const constraints = {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // 检查是否在初始化过程中被取消
      if (!initializingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // 等待视频元素准备好
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current;
          if (!video) {
            reject(new Error('Video element not found'));
            return;
          }
          
          const handleCanPlay = () => {
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = (e: Event) => {
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            reject(new Error('Video load error'));
          };
          
          video.addEventListener('canplay', handleCanPlay);
          video.addEventListener('error', handleError);
          
          // 如果视频已经可以播放
          if (video.readyState >= 3) {
            handleCanPlay();
          }
        });
        
        // 再次检查是否被取消
        if (!initializingRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        // 播放视频
        playPromiseRef.current = videoRef.current.play();
        await playPromiseRef.current;
        playPromiseRef.current = null;
        
        setIsCameraReady(true);
      }
    } catch (err: any) {
      // 忽略 AbortError，这是正常的取消操作
      if (err.name === 'AbortError') {
        console.log('Camera initialization was aborted');
        return;
      }
      
      console.error('Camera error:', err);
      
      // 根据错误类型显示不同的提示
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('相机权限被拒绝，请在设置中允许访问相机');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('未找到相机设备');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('相机被其他应用占用，请关闭其他应用后重试');
      } else {
        setError('无法访问相机，请检查权限设置');
      }
    } finally {
      initializingRef.current = false;
    }
  }, [isFrontCamera]);

  // 拍照
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 前置摄像头需要镜像
    if (isFrontCamera) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    setMode('preview');
    stopCamera();
  };

  // 从相册选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target?.result as string);
      setMode('preview');
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  // 重新拍照
  const retake = () => {
    setCapturedImage(null);
    setMode('capture');
  };

  // 确认使用照片
  const confirmPhoto = async () => {
    if (!capturedImage || !isAuthenticated) {
      if (!isAuthenticated) {
        window.location.href = getLoginUrl();
      }
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 上传照片
      const base64Data = capturedImage.split(',')[1];
      const { url: selfieUrl } = await uploadMutation.mutateAsync({
        imageBase64: base64Data,
        mimeType: 'image/jpeg',
      });

      // 异步调用 AI 用户判别（不阻塞主流程）
      setIsAnalyzing(true);
      const analyzePromise = analyzeUserMutation.mutateAsync({ selfieUrl })
        .then(result => {
          if (result.success) {
            console.log('[Camera] Face analysis result:', result);
            setFaceAnalysisResult({
              faceType: result.faceType,
              gender: result.gender,
              userType: result.userType,
            });
          }
        })
        .catch(err => {
          console.error('[Camera] Face analysis error:', err);
        })
        .finally(() => {
          setIsAnalyzing(false);
        });

      // 如果有选中的模板，等待用户判别完成后创建换脸任务
      if (templateIds.length > 0) {
        // 等待用户判别完成（最多等待 10 秒）
        let analysisResult: { faceType?: string } | null = null;
        try {
          const result = await Promise.race([
            analyzePromise.then(() => faceAnalysisResult),
            analyzeUserMutation.mutateAsync({ selfieUrl }),
          ]);
          if (result && typeof result === 'object' && 'faceType' in result) {
            analysisResult = result;
          }
        } catch {
          console.log('[Camera] Face analysis timeout or error, proceeding without face type');
        }

        // 从 localStorage 获取推广员绑定信息
        const boundChannelId = localStorage.getItem('boundChannelId');
        const boundSalesId = localStorage.getItem('boundSalesId');
        
        const { photoId } = await createPhotoMutation.mutateAsync({
          selfieUrl,
          templateId: templateIds[0],
          channelId: boundChannelId ? parseInt(boundChannelId) : undefined,
          salesId: boundSalesId ? parseInt(boundSalesId) : undefined,
          detectedFaceType: analysisResult?.faceType, // 传入脸型判别结果
        });

        // 跳转到生成页面
        navigate(`/generating/${photoId}`);
      } else {
        // 没有选择模板，跳转到模板选择页（并将脸型信息存入 sessionStorage）
        sessionStorage.setItem('pendingFaceAnalysis', 'true');
        sessionStorage.setItem('selfieUrl', selfieUrl);
        navigate(`/templates?selfie=${encodeURIComponent(selfieUrl)}`);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || '上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  // 返回
  const handleBack = () => {
    stopCamera();
    window.history.back();
  };

  // 初始化相机 - 只在 mode 变为 capture 时执行
  useEffect(() => {
    if (mode === 'capture') {
      initCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [mode]); // 移除 initCamera 和 stopCamera 依赖，避免无限循环

  // 监听摄像头切换 - 使用单独的 effect
  useEffect(() => {
    if (mode === 'capture' && !initializingRef.current) {
      // 切换摄像头时重新初始化
      stopCamera();
      // 使用 setTimeout 确保停止操作完成
      const timer = setTimeout(() => {
        initCamera();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFrontCamera]); // 只监听 isFrontCamera 变化

  return (
    <div className="mini-app-container bg-black relative">
      {/* 隐藏的 canvas 用于拍照 */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 顶部导航 - 浅灰色背景 */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-[#f5f5f5] safe-area-top">
        <div className="h-11" />
        <div className="h-[54px] px-4 flex items-center">
          <button
            className="flex items-center gap-1 text-[#333]"
            onClick={handleBack}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-base">返回</span>
          </button>
        </div>
      </div>

      {mode === 'capture' ? (
        <>
          {/* 相机预览区域 */}
          <div className="absolute inset-0 pt-[109px]">
            <video
              ref={videoRef}
              className={cn(
                "w-full h-full object-cover",
                isFrontCamera && "scale-x-[-1]"
              )}
              playsInline
              muted
              autoPlay
            />

            {/* 相机加载中提示 */}
            {!isCameraReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm">正在启动相机...</span>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="flex flex-col items-center gap-4 px-8">
                  <div className="text-red-400 text-center">{error}</div>
                  <button
                    className="px-6 py-2 bg-[#e89a8d] text-white rounded-lg"
                    onClick={() => {
                      setError(null);
                      initCamera();
                    }}
                  >
                    重试
                  </button>
                </div>
              </div>
            )}

            {/* 人脸引导框 - 四角边框样式 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-80px' }}>
              <div className="w-[260px] h-[360px] relative">
                {/* 左上角 */}
                <div className="absolute top-0 left-0 w-6 h-6 border-l-[3px] border-t-[3px] border-white" />
                {/* 右上角 */}
                <div className="absolute top-0 right-0 w-6 h-6 border-r-[3px] border-t-[3px] border-white" />
                {/* 左下角 */}
                <div className="absolute bottom-0 left-0 w-6 h-6 border-l-[3px] border-b-[3px] border-white" />
                {/* 右下角 */}
                <div className="absolute bottom-0 right-0 w-6 h-6 border-r-[3px] border-b-[3px] border-white" />
              </div>
            </div>

            {/* 底部提示文字卡片 */}
            <div className="absolute left-4 right-4 bottom-[180px] z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3">
                <p className="text-[#333] text-sm leading-relaxed text-center">
                  拍照的时候注意确保面部没有口罩、眼镜、帽子等遮挡物；脸要正对镜头，眼镜看向摄像头。
                </p>
              </div>
            </div>

            {/* 底部拍照按钮 */}
            <div className="absolute bottom-0 left-0 right-0 pb-12 safe-area-bottom">
              <div className="flex items-center justify-center">
                <button
                  className={cn(
                    "w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg transition-opacity",
                    !isCameraReady && "opacity-50"
                  )}
                  onClick={capturePhoto}
                  disabled={!isCameraReady}
                >
                  <div className="w-[60px] h-[60px] rounded-full border-[3px] border-[#333]" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 预览模式 */}
          <div className="absolute inset-0 pt-[109px]">
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            )}

            {/* 人脸引导框 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-80px' }}>
              <div className="w-[260px] h-[360px] relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-l-[3px] border-t-[3px] border-white" />
                <div className="absolute top-0 right-0 w-6 h-6 border-r-[3px] border-t-[3px] border-white" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-l-[3px] border-b-[3px] border-white" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-r-[3px] border-b-[3px] border-white" />
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded-lg z-20">
                {error}
              </div>
            )}

            {/* 底部操作区 */}
            <div className="absolute bottom-0 left-0 right-0 pb-12 safe-area-bottom">
              <div className="flex items-center justify-center gap-20">
                {/* 重拍 */}
                <button
                  className="flex flex-col items-center gap-2"
                  onClick={retake}
                  disabled={isUploading}
                >
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <RotateCcw className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs">重拍</span>
                </button>

                {/* 确认使用 */}
                <button
                  className="flex flex-col items-center gap-2"
                  onClick={confirmPhoto}
                  disabled={isUploading}
                >
                  <div className={cn(
                    "w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-lg",
                    isUploading ? "bg-[#e89a8d]/50" : "bg-[#e89a8d]"
                  )}>
                    {isUploading ? (
                      <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <span className="text-white text-xs">
                    {isUploading ? '上传中...' : '使用照片'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
