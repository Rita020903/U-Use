-- 未来接 Supabase 时使用的基础表结构草稿。
-- 当前 demo 使用本地 JSON 文件持久化。此草稿尚未接入，也尚未配置 RLS。

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  school text not null default '西交利物浦大学',
  campus text check (campus in ('SIP', 'TAICANG')),
  email_verified boolean not null default false,
  role text not null default 'student' check (role in ('student', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10,2) not null default 0,
  access_mode text not null default 'borrow' check (access_mode in ('buy', 'borrow', 'rent', 'swap')),
  deposit numeric(10,2) not null default 0,
  rent_price numeric(10,2),
  available_from date,
  available_to date,
  availability_label text,
  return_required boolean not null default true,
  return_rule text,
  category text not null,
  condition text not null,
  campus text not null check (campus in ('SIP', 'TAICANG')),
  spot text not null,
  cross_campus boolean not null default false,
  status text not null default '审核中' check (status in ('草稿', '审核中', '可用', '已预约', '使用中', '待归还', '已归还', '已下架', '审核拒绝')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id),
  owner_id uuid not null references profiles(id),
  campus text not null check (campus in ('SIP', 'TAICANG')),
  spot text not null,
  handover_time timestamptz,
  return_time timestamptz,
  deposit_amount numeric(10,2) not null default 0,
  rent_amount numeric(10,2) not null default 0,
  note text,
  status text not null default '待确认' check (status in ('待确认', '已确认', '已交付', '使用中', '待归还', '已归还', '已完成', '已取消', '有争议')),
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id),
  target_type text not null check (target_type in ('product', 'profile', 'message')),
  target_id uuid,
  reason text not null,
  note text,
  status text not null default '待处理' check (status in ('待处理', '处理中', '已处理', '驳回')),
  created_at timestamptz not null default now()
);
