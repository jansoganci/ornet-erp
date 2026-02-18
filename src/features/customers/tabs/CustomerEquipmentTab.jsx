import { SiteAssetsCard } from '../../siteAssets';

export function CustomerEquipmentTab({ customerId, sites = [] }) {
  return (
    <SiteAssetsCard customerId={customerId} sites={sites} />
  );
}
