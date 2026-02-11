import { NavigateFunction } from 'react-router-dom';

/**
 * Interface for user object that contains slug information
 */
export interface UserWithSlug {
  username?: string;
  public_slug?: string;
  id?: string;
  [key: string]: any;
}

/**
 * Safely navigates to a user's public profile using their slug (username) or ID.
 * Prevents [object Object] in URL by validating the input.
 * 
 * @param navigate The navigate function from useNavigate()
 * @param userOrId The user object or user ID string
 * @param state Optional state to pass to the route (e.g., event context)
 */
export function goToPublicProfile(
  navigate: NavigateFunction, 
  userOrId: UserWithSlug | string,
  state?: any
) {
  let slug: string | undefined;

  if (typeof userOrId === 'string') {
    slug = userOrId;
  } else if (userOrId && typeof userOrId === 'object') {
    // Prioritize username (our slug implementation)
    slug = userOrId.username || userOrId.public_slug || userOrId.id || userOrId.user_id;
  }

  // Strict validation: Must be a string and not empty
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    console.error('❌ [goToPublicProfile] Invalid slug/ID:', userOrId);
    return;
  }

  // Defensive check against "[object Object]" literally appearing in string
  if (slug.includes('[object Object]')) {
    console.error('❌ [goToPublicProfile] Detected [object Object] in slug:', slug);
    return;
  }

  navigate(`/perfil-publico/${slug}`, { state });
}
