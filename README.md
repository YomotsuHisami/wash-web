# Wash Web

一个面向洗鞋/洗护场景的 Web 应用，包含用户端下单流程、会员与活动展示、订单中心，以及管理员后台。项目采用前后端同仓结构：前端使用 React + Ionic + Vite，后端使用 Express，在本地通过 JSON 文件保存数据。

## 项目特点

- 用户端支持注册、登录、资料维护与会员升级
- 下单流程支持三张鞋图拍摄、估价展示、优惠选择、订单资料填写与支付确认
- 首页、介绍页、会员页、订单页、账户页和管理页已打通
- 管理后台支持管理员密码初始化、登录、订单管理、门店管理、折扣管理
- 服务端会将订单图片落盘到 `public/uploads/orders`
- 数据默认保存在本地 `data/*.json`，适合演示、原型和本地部署

## 实现说明

- “识别鞋款与估价”是前端模拟流程，使用 `src/data/mockData.ts` 中的 mock 数据生成识别结果，不是正式 AI 推理接口
- 管理员鉴权目前是演示实现，登录成功后返回固定 `demo-token`
- 用户密码与管理员密码目前以明文形式保存在本地 JSON 文件中，仅适合开发或演示环境

## 技术栈

- 前端：React 19、Ionic React、React Router 5、Vite、TypeScript
- 后端：Express、TSX
- 样式：自定义 CSS
- 数据存储：本地 JSON 文件

## 目录结构

```text
.
├─ src/                 前端源码
├─ public/              静态资源与上传目录
├─ data/                本地数据文件
├─ dist/                构建产物
├─ server.ts            Express + Vite 开发服务器
├─ package.json
└─ README.md
```

## 运行环境

- Node.js 18 及以上
- npm 9 及以上

## 安装依赖

```bash
npm install
```

## 本地开发

```bash
npm run dev
```

启动后访问：

```text
http://localhost:3000
```

开发模式下，`server.ts` 会启动 Express，并以内嵌 Vite 中间件的方式提供前端页面与接口服务。

## 构建前端

```bash
npm run build
```

构建结果输出到 `dist/`。

## 默认数据文件

服务启动时会自动检查并初始化以下文件：

- `data/orders.json`：订单数据
- `data/shops.json`：门店数据
- `data/admin_config.json`：管理员配置
- `data/users.json`：用户数据
- `data/discounts.json`：折扣数据

首次启动时，系统会自动写入 3 个示例门店。

## 主要功能

### 用户端

- 首页查看品牌信息、活动、门店和最近订单
- 注册/登录用户账号
- 维护默认联系人、地址、门店、取件偏好
- 进入拍照估价流程，上传三张鞋图
- 查看识别报告、污损拆分与价格汇总
- 选择适用折扣并提交订单
- 模拟扫码支付并更新订单状态
- 查看本地订单与服务端订单详情
- 开通会员后获得 VIP 身份

### 管理端

- 首次进入可设置管理员密码
- 登录后查看全部订单
- 修改订单状态
- 删除订单
- 新增、编辑、删除门店
- 新增、编辑、删除折扣活动

## 主要接口

### 管理员

- `POST /api/admin/setup`：初始化管理员密码
- `POST /api/admin/login`：管理员登录
- `GET /api/admin/status`：查询管理员是否已初始化
- `GET /api/admin/verify`：校验管理员 token

### 订单

- `GET /api/orders`：获取全部订单，需要管理员 token
- `POST /api/orders`：创建订单
- `GET /api/orders/:id`：获取单个订单
- `PUT /api/orders/:id/status`：修改订单状态，需要管理员 token
- `POST /api/orders/:id/pay`：标记订单为已支付
- `DELETE /api/orders/:id`：删除订单

### 门店

- `GET /api/shops`：获取门店列表
- `POST /api/shops`：创建门店，需要管理员 token
- `PUT /api/shops/:id`：更新门店，需要管理员 token
- `DELETE /api/shops/:id`：删除门店，需要管理员 token

### 用户

- `POST /api/users/register`：注册
- `POST /api/users/login`：登录
- `GET /api/users/:id`：获取用户资料
- `PUT /api/users/:id/defaultInfo`：更新默认资料
- `PUT /api/users/:id/password`：修改密码
- `POST /api/users/:id/upgrade`：升级为 VIP

### 折扣

- `GET /api/discounts`：获取折扣列表
- `POST /api/discounts`：创建折扣，需要管理员 token
- `PUT /api/discounts/:id`：更新折扣，需要管理员 token
- `DELETE /api/discounts/:id`：删除折扣，需要管理员 token

## 上传与静态资源

- 订单提交时，如果图片是 base64 数据，服务端会自动转存到 `public/uploads/orders`
- 图片最终通过 `/uploads/orders/*` 路径对外访问
- 生产模式下会托管 `dist/` 和 `public/uploads` 下的内容

## 已知限制

- 暂未接入数据库，重度并发与多实例部署不适合使用当前 JSON 存储方案
- 暂未接入真实支付，仅提供“我已完成支付”的演示流程
- 暂未接入真实 AI 识别与估价服务
- 鉴权、密码存储与权限控制仍是演示级实现

## 后续可优化方向

- 将订单、用户、门店、折扣迁移到数据库
- 为管理员与用户接入真正的鉴权体系
- 密码改为加盐哈希存储
- 接入真实图像识别/估价模型服务
- 为支付流程接入真实支付平台
- 为服务端与前端补齐测试