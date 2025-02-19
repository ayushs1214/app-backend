/*
  # User Management Schema

  1. New Tables
    - `user_profiles`: Stores detailed user information
    - `admin_notifications`: Stores notifications for admin
  
  2. Security
    - Enable RLS on both tables
    - Add policies for user access
*/

-- Create enum type for user types
DO $$ BEGIN
  CREATE TYPE user_type_enum AS ENUM ('builder', 'architect', 'dealer', 'salesperson');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_type user_type_enum NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  mobile_number text NOT NULL,
  is_approved boolean DEFAULT false,
  approval_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE
);

-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  user_id uuid,
  content text NOT NULL,
  status text DEFAULT 'unread',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE SET NULL
);

-- Create updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ BEGIN
  -- User profiles policies
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
  CREATE POLICY "Users can view own profile"
    ON user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Admin can view all profiles" ON user_profiles;
  CREATE POLICY "Admin can view all profiles"
    ON user_profiles
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM auth.users
        WHERE auth.uid() = id
        AND raw_user_meta_data->>'is_admin' = 'true'
      )
    );

  -- Admin notifications policies
  DROP POLICY IF EXISTS "Admin can view all notifications" ON admin_notifications;
  CREATE POLICY "Admin can view all notifications"
    ON admin_notifications
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM auth.users
        WHERE auth.uid() = id
        AND raw_user_meta_data->>'is_admin' = 'true'
      )
    );
END $$;