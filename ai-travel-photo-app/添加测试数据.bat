@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   AI旅拍 - 添加测试数据
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查环境...
where node >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Node.js
    echo 请确保已安装 Node.js
    pause
    exit /b 1
)
echo ✓ Node.js 已安装

echo.
echo [2/3] 执行添加数据脚本...
echo.
npx tsx scripts/add-test-data.js

if errorlevel 1 (
    echo.
    echo ========================================
    echo   执行失败！
    echo ========================================
    echo.
    echo 可能的原因:
    echo 1. MySQL 服务未启动
    echo 2. 数据库密码错误
    echo 3. 数据库不存在
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   数据添加成功！
echo ========================================
echo.
echo 下一步:
echo 1. 回到微信开发者工具
echo 2. 按 Ctrl+B 重新编译小程序
echo 3. 查看效果
echo.
pause
