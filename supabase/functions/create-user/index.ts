import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  role: 'super_admin' | 'store_gm' | 'department_manager' | 'read_only';
  store_id?: string;
  birthday_month?: number;
  birthday_day?: number;
  start_month?: number;
  start_year?: number;
  send_password_email?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestBody: CreateUserRequest = await req.json();
    let { email, full_name, role, store_id, birthday_month, birthday_day, start_month, start_year, send_password_email } = requestBody;

    // Auto-generate email if not provided
    if (!email || email.trim() === '') {
      const randomId = crypto.randomUUID().slice(0, 8);
      email = `user-${randomId}@test.local`;
      console.log('Auto-generated email:', email);
    }

    console.log('Creating user:', { email, full_name, role });

    // Generate a temporary password
    const tempPassword = crypto.randomUUID();

    // Create the user in auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        birthday_month,
        birthday_day,
        start_month,
        start_year,
      },
    });

    if (userError) {
      console.error('Error creating user:', userError);
      throw userError;
    }

    console.log('User created in auth:', userData.user.id);

    // Update the profile with role and store_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role,
        store_id: store_id || null,
      })
      .eq('id', userData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    console.log('Profile updated successfully');

    // Send password reset email so user can set their own password (if requested)
    if (send_password_email) {
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
      });

      if (resetError) {
        console.warn('Error sending password reset email:', resetError);
      } else {
        console.log('Password reset email sent successfully');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userData.user.id,
          email: userData.user.email,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in create-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
