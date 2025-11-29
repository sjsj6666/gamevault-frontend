import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        account: resolve(__dirname, 'account.html'),
        // Add auth.html if you have it
        blog: resolve(__dirname, 'blog.html'),
        games: resolve(__dirname, 'games.html'),
        invite: resolve(__dirname, 'invite.html'),
        order_details: resolve(__dirname, 'order-details.html'),
        payment_gateway: resolve(__dirname, 'payment-gateway.html'),
        payment_page: resolve(__dirname, 'payment-page.html'),
        post: resolve(__dirname, 'post.html'),
        topup: resolve(__dirname, 'topup-page.html'),
        // Add admin files if they are in an admin folder
        // admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
});