export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function calculateReferralReward(planType: string): number {
  switch (planType.toLowerCase()) {
    case 'professional':
      return 7;
    case 'executive':
      return 10;
    case 'basic':
    default:
      return 5;
  }
}
