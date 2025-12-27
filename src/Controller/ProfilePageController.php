<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\Subscriptions;
use App\Form\ProfileFormType;
use App\Repository\SubscriptionsRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;


final class ProfilePageController extends AbstractController
{
    #[Route('/profile-page/{id}', name: 'app_profile')]
    public function index(Request $request, SubscriptionsRepository  $subRepo, EntityManagerInterface $em, int $id ): Response
    {

        $user = $em->getRepository(User::class)->find($id);
        if (!$user) {
            throw $this->createNotFoundException('User not found');
        }

        $subscribers = $subRepo->findSubscribersOf($user);

        $form = $this->createForm(ProfileFormType::class, $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($user);
            $em->flush();
            $this->addFlash('success', 'User updated successfully!');

            return $this->redirectToRoute('app_profile', ['user' => $user->getId()]);
        }
        return $this->render('profile_page/index.html.twig', [
            'form' => $form,
            'subscribers' => $subscribers,
        ]);
    }

    #[Route('/public-profile-page/{id}', name: 'app_public_profile', methods: ['GET', 'POST'])]
    public function subscribe(EntityManagerInterface $em, Request $request, SubscriptionsRepository $subRepo, int $id): Response
    {
        $user = $em->getRepository(User::class)->find($id);
        if (!$user) {
            throw $this->createNotFoundException('User not found');
        }

        $currentUser = $this->getUser();
        $existing = null;
        $isSubscribed = false;

        if ($currentUser) {
            $existing = $subRepo->findOneBy(['follower' => $currentUser, 'following' => $user]);
            $isSubscribed = $existing !== null;
        }

        if ($request->isMethod('POST')) {
            if (!$currentUser) {
                return $this->redirectToRoute('app_login');
            }

            if (!$this->isCsrfTokenValid('subscribe'.$user->getId(), $request->request->get('_token'))) {
                throw $this->createAccessDeniedException('Invalid CSRF token');
            }

            if ($existing) {
                $em->remove($existing);
                $em->flush();
                $this->addFlash('success', 'Unsubscribed.');
            } else {
                $subscription = new Subscriptions();
                $subscription->setFollower($currentUser);
                $subscription->setFollowing($user);
                $em->persist($subscription);
                $em->flush();
                $this->addFlash('success', 'Subscribed.');
            }

            return $this->redirectToRoute('app_public_profile', ['id' => $user->getId()]);
        }

        return $this->render('profile_page/public.html.twig', [
            'user' => $user,
            'isSubscribed' => $isSubscribed,
        ]);
    }
}
