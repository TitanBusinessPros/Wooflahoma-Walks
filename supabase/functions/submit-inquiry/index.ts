import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { 
      ownerName, 
      phone, 
      email, 
      address, 
      dogName, 
      dogBreed, 
      dogWeight, 
      dogPhoto,
      specialNotes 
    } = await req.json()

    // Validate required fields
    if (!ownerName || !phone || !email || !address || !dogName || !dogBreed || !dogWeight) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let dogPhotoUrl = null

    // Handle photo upload if provided
    if (dogPhoto) {
      try {
        // Convert base64 to file
        const base64Data = dogPhoto.split(',')[1]
        const imageData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        
        // Generate unique filename
        const fileName = `dog-photo-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('dog-photos')
          .upload(fileName, imageData, {
            contentType: 'image/jpeg',
            upsert: false
          })

        if (uploadError) {
          console.error('Photo upload error:', uploadError)
        } else {
          // Get public URL
          const { data: { publicUrl } } = supabaseClient.storage
            .from('dog-photos')
            .getPublicUrl(fileName)
          
          dogPhotoUrl = publicUrl
        }
      } catch (photoError) {
        console.error('Photo processing error:', photoError)
        // Continue without photo if upload fails
      }
    }

    // Insert inquiry into database
    const { data, error } = await supabaseClient
      .from('customer_inquiries')
      .insert([
        {
          owner_name: ownerName,
          phone: phone,
          email: email,
          address: address,
          dog_name: dogName,
          dog_breed: dogBreed,
          dog_weight: parseInt(dogWeight),
          dog_photo_url: dogPhotoUrl,
          special_notes: specialNotes || null,
          status: 'new'
        }
      ])
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to save inquiry' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // TODO: Send email notification when RESEND_API_KEY is configured
    // This will be implemented once the API key is provided

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Inquiry submitted successfully!',
        data: data[0]
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})