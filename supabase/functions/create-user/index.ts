import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  role: 'super_admin' | 'store_gm' | 'department_manager' | 'read_only' | 'sales_advisor' | 'service_advisor' | 'technician' | 'parts_advisor';
  store_id?: string;
  store_ids?: string[]; // New multi-store support
  store_group_id?: string;
  department_id?: string; // Legacy single department support
  department_ids?: string[]; // New multi-department support
  birthday_month?: number;
  birthday_day?: number;
  start_month?: number;
  start_year?: number;
  send_password_email?: boolean;
}

// Generate the invite email HTML
function getInviteEmailHtml(inviteLink: string, fullName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited to Dealer Growth Solutions</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a; margin-bottom: 10px;">Welcome to Dealer Growth Solutions</h1>
      </div>
      
      <p>Hello ${fullName || 'there'},</p>
      
      <p>You've been invited to join Dealer Growth Solutions. Click the button below to set your password and access your account.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Set Your Password</a>
      </div>
      
      <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #2563eb; font-size: 14px;">${inviteLink}</p>
      
      <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation link will expire in 24 hours.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px; text-align: center;">
        Dealer Growth Solutions<br>
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </body>
    </html>
  `;
}

// Send email via Resend
async function sendInviteEmailViaResend(
  email: string, 
  inviteLink: string, 
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not configured');
    return { success: false, error: 'Email service not configured' };
  }

  const resend = new Resend(resendApiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Dealer Growth Solutions <noreply@dealergrowth.solutions>',
      to: [email],
      subject: "You're Invited to Dealer Growth Solutions",
      html: getInviteEmailHtml(inviteLink, fullName),
    });

    if (error) {
      console.error('Resend API error:', error);
      return { success: false, error: error.message };
    }

    console.log('Invite email sent successfully via Resend:', data);
    return { success: true };
  } catch (err) {
    console.error('Error sending email via Resend:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown email error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // SECURITY: Verify caller has super_admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check if caller has super_admin, store_gm, or department_manager role
    // Use admin client to bypass RLS on user_roles table
    const { data: callerRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'store_gm', 'department_manager']);

    if (roleError || !callerRoles || callerRoles.length === 0) {
      console.error('Role check failed:', roleError, 'User ID:', user.id, 'Roles found:', callerRoles);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Forbidden: Only super admins, store GMs, and department managers can create users' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const callerRole = callerRoles[0].role;
    console.log('Caller role:', callerRole);

    console.log('Authorization successful for user:', user.id);

    const requestBody: CreateUserRequest = await req.json();
    let { email, full_name, role, store_id, store_ids, store_group_id, department_id, department_ids, birthday_month, birthday_day, start_month, start_year, send_password_email } = requestBody;
    
    // Support both legacy single department_id and new department_ids array
    const finalDepartmentIds: string[] = department_ids || (department_id ? [department_id] : []);
    
    // Support both legacy single store_id and new store_ids array
    const finalStoreIds: string[] = store_ids || (store_id ? [store_id] : []);

    // SECURITY: For non-super-admins, enforce store assignment to their own store
    if (callerRole === 'store_gm' || callerRole === 'department_manager') {
      // Get caller's store and store group
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('store_id, store_group_id')
        .eq('id', user.id)
        .single();
      
      if (callerProfile?.store_id) {
        // Force the store_id to be the caller's store
        store_id = callerProfile.store_id;
        store_group_id = callerProfile.store_group_id;
        console.log('Enforced store assignment to caller store:', store_id);
      }
    }

    // If department manager, verify they can only add users to their own departments
    if (callerRole === 'department_manager' && finalDepartmentIds.length > 0) {
      const { data: callerDepts } = await supabaseAdmin
        .from('departments')
        .select('id')
        .eq('manager_id', user.id);
      
      const { data: callerAccess } = await supabaseAdmin
        .from('user_department_access')
        .select('department_id')
        .eq('user_id', user.id);
      
      const allowedDeptIds = [
        ...(callerDepts?.map(d => d.id) || []),
        ...(callerAccess?.map(a => a.department_id) || [])
      ];
      
      const unauthorizedDepts = finalDepartmentIds.filter(id => !allowedDeptIds.includes(id));
      if (unauthorizedDepts.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Forbidden: You can only add users to departments you manage' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }

    // SECURITY: Validate role and enforce role creation restrictions
    const validRoles = ['super_admin', 'store_gm', 'department_manager', 'read_only', 'sales_advisor', 'service_advisor', 'technician', 'parts_advisor', 'fixed_ops_manager'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Only super admins can create super_admin users
    if (role === 'super_admin' && callerRole !== 'super_admin') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Forbidden: Only super admins can create super admin users' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Only super admins can create store_gm users
    if (role === 'store_gm' && callerRole !== 'super_admin') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Forbidden: Only super admins can create store GM users' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Auto-generate email if not provided
    if (!email || email.trim() === '') {
      const randomId = crypto.randomUUID().slice(0, 8);
      email = `user-${randomId}@test.local`;
      console.log('Auto-generated email:', email);
    }

    console.log('Creating user:', { email, full_name, role });

    // Get the origin from the referer header for redirect URL
    const referer = req.headers.get('referer') || '';
    const origin = referer ? new URL(referer).origin : 'https://dealergrowth.solutions';

    // Generate the invite link (doesn't send email via Supabase)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: `${origin}/set-password`,
        data: {
          full_name,
          birthday_month,
          birthday_day,
          start_month,
          start_year,
        },
      },
    });

    if (linkError) {
      console.error('Error generating invite link:', linkError);
      throw linkError;
    }

    if (!linkData?.properties?.action_link) {
      console.error('No action link returned from generateLink');
      throw new Error('Failed to generate invite link');
    }

    const inviteLink = linkData.properties.action_link;
    const userId = linkData.user.id;

    console.log('User created in auth:', userId);
    console.log('Invite link generated successfully');

    // Send the invite email via Resend
    const emailResult = await sendInviteEmailViaResend(email, inviteLink, full_name);
    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error);
      // Note: We continue even if email fails - user is created, admin can resend later
    } else {
      console.log('Invite email sent successfully to:', email);
      
      // Update invited_at timestamp in profiles
      const { error: invitedAtError } = await supabaseAdmin
        .from('profiles')
        .update({ invited_at: new Date().toISOString() })
        .eq('id', userId);
      
      if (invitedAtError) {
        console.error('Error updating invited_at:', invitedAtError);
      }
    }

    // Insert into user_roles table (primary source of truth for roles)
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
        assigned_by: user.id,
      });

    if (userRoleError) {
      console.error('Error creating user role:', userRoleError);
      throw userRoleError;
    }

    // If store_group_id not provided but store_id is, get group from the store
    let finalStoreGroupId = store_group_id || null;
    if (!finalStoreGroupId && store_id) {
      const { data: storeData } = await supabaseAdmin
        .from('stores')
        .select('group_id')
        .eq('id', store_id)
        .single();
      
      if (storeData?.group_id) {
        finalStoreGroupId = storeData.group_id;
        console.log('Auto-derived store_group_id from store:', finalStoreGroupId);
      }
    }

    // Update the profile with store_id and store_group_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        store_id: store_id || null,
        store_group_id: finalStoreGroupId,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    console.log('User role and profile updated successfully');

    // If department_ids are provided, update departments and grant access
    if (finalDepartmentIds.length > 0) {
      for (const deptId of finalDepartmentIds) {
        // Set user as manager of the department
        const { error: departmentError } = await supabaseAdmin
          .from('departments')
          .update({ manager_id: userId })
          .eq('id', deptId);

        if (departmentError) {
          console.error('Error assigning user to department:', deptId, departmentError);
        } else {
          console.log('User assigned as department manager for department:', deptId);
        }
        
        // Add to user_department_access table for access control
        const { error: accessError } = await supabaseAdmin
          .from('user_department_access')
          .insert({
            user_id: userId,
            department_id: deptId,
            granted_by: user.id
          });

        if (accessError) {
          console.error('Error adding user department access:', deptId, accessError);
        } else {
          console.log('User granted access to department:', deptId);
        }
      }
    }

    // If store_ids are provided, add to user_store_access table
    if (finalStoreIds.length > 0) {
      for (const storeId of finalStoreIds) {
        const { error: storeAccessError } = await supabaseAdmin
          .from('user_store_access')
          .insert({
            user_id: userId,
            store_id: storeId,
            granted_by: user.id
          });

        if (storeAccessError) {
          console.error('Error adding user store access:', storeId, storeAccessError);
        } else {
          console.log('User granted access to store:', storeId);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: linkData.user.email,
        },
        emailSent: emailResult.success,
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