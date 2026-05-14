
-- 用户角色枚举
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- 反馈状态枚举
CREATE TYPE public.feedback_status AS ENUM ('pending', 'processing', 'completed');

-- 反馈类型枚举
CREATE TYPE public.feedback_type AS ENUM ('security', 'traffic', 'service', 'other');

-- 用户档案表
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  email text,
  role user_role NOT NULL DEFAULT 'user',
  openid text,
  station_id uuid, -- 管理员所属派出所ID，后续添加外键
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 自动同步新用户到profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role, openid)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'username')::text,
    'user'::public.user_role,
    (NEW.raw_user_meta_data->>'openid')::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 辅助函数：获取用户角色（避免策略递归）
CREATE OR REPLACE FUNCTION get_user_role(uid uuid)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = uid;
$$;

-- 辅助函数：获取管理员所属派出所ID
CREATE OR REPLACE FUNCTION get_admin_station_id(uid uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT station_id FROM profiles WHERE id = uid AND role = 'admin'::user_role;
$$;

-- profiles 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理员全权访问profiles" ON profiles
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "用户查看自己的档案" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "用户更新自己的档案" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM get_user_role(auth.uid()));

-- 匿名认证映射表（市民无需注册）
CREATE TABLE public.anon_credential_map (
  credential_id uuid PRIMARY KEY,
  auth_uid uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 关闭RLS，服务角色直接操作
ALTER TABLE public.anon_credential_map ENABLE ROW LEVEL SECURITY;
-- 不创建任何策略，只有服务角色可以访问

-- 派出所表
CREATE TABLE public.police_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  district text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.police_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有已认证用户可查看派出所" ON police_stations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "管理员可修改派出所" ON police_stations
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- 添加派出所外键到profiles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_station_id_fkey FOREIGN KEY (station_id) REFERENCES police_stations(id);

-- 反馈投诉表
CREATE TABLE public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES police_stations(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  type feedback_type NOT NULL DEFAULT 'other',
  description text NOT NULL,
  contact text,
  status feedback_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- 市民可以查看和提交自己的反馈
CREATE POLICY "市民查看自己的反馈" ON feedbacks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "市民提交反馈" ON feedbacks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 管理员可以查看和更新自己派出所的反馈
CREATE POLICY "管理员查看本站反馈" ON feedbacks
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'::user_role
    AND station_id = get_admin_station_id(auth.uid())
  );

CREATE POLICY "管理员更新本站反馈状态" ON feedbacks
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'::user_role
    AND station_id = get_admin_station_id(auth.uid())
  );

-- 反馈图片表
CREATE TABLE public.feedback_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "查看反馈图片（市民本人）" ON feedback_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM feedbacks f
      WHERE f.id = feedback_id AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "查看反馈图片（管理员）" ON feedback_images
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'::user_role
    AND EXISTS (
      SELECT 1 FROM feedbacks f
      WHERE f.id = feedback_id AND f.station_id = get_admin_station_id(auth.uid())
    )
  );

CREATE POLICY "市民上传图片" ON feedback_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM feedbacks f
      WHERE f.id = feedback_id AND f.user_id = auth.uid()
    )
  );

-- 双向沟通消息表
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  sender_role text NOT NULL CHECK (sender_role IN ('citizen', 'admin')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "查看消息（市民本人）" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM feedbacks f
      WHERE f.id = feedback_id AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "查看消息（管理员）" ON messages
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'::user_role
    AND EXISTS (
      SELECT 1 FROM feedbacks f
      WHERE f.id = feedback_id AND f.station_id = get_admin_station_id(auth.uid())
    )
  );

CREATE POLICY "市民发送消息" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'citizen'
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM feedbacks f
      WHERE f.id = feedback_id AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "管理员发送消息" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'admin'
    AND auth.uid() = user_id
    AND get_user_role(auth.uid()) = 'admin'::user_role
    AND EXISTS (
      SELECT 1 FROM feedbacks f
      WHERE f.id = feedback_id AND f.station_id = get_admin_station_id(auth.uid())
    )
  );

-- 启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE feedbacks;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 反馈Storage桶（通过SQL创建）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-images',
  'feedback-images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage策略：已认证用户可上传
CREATE POLICY "已认证用户上传反馈图片" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-images');

CREATE POLICY "公开查看反馈图片" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'feedback-images');

-- 初始数据：插入示例派出所
INSERT INTO public.police_stations (id, name, address, district) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '朝阳区建国门派出所', '北京市朝阳区建国门外大街1号', '朝阳区'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', '海淀区中关村派出所', '北京市海淀区中关村大街1号', '海淀区');
