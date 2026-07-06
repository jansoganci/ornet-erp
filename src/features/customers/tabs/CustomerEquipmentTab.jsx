import { useCustomerDetail } from '../customerDetailContextBase';
import { SiteAssetsCard } from '../../siteAssets';

export function CustomerEquipmentTab() {
  const { customerId, sites = [] } = useCustomerDetail();
  return <SiteAssetsCard customerId={customerId} sites={sites} />;
}
