export const ADMIN_EMAILS = [
  'velinrai.vr@gmail.com',
  'thingbiraj77@gmail.com',
  'business.seekscape@gmail.com',
  'salinatmg.npl@gmail.com',
  'wanewasalina@gmail.com',
  'sundargurung110@gmail.com',
  'walknepalwalk@gmail.com'
];

export const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};
