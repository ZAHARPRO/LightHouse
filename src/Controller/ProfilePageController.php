<?php

namespace App\Controller;

use App\Entity\User;
use App\Form\ProfileFormType;
use App\Repository\MySubcribersRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;


final class ProfilePageController extends AbstractController
{
    #[Route('/profile-page/{id}', name: 'app_profile')]
    public function index(Request $request, MySubcribersRepository $subRepo, EntityManagerInterface $em, int $id ): Response
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
    #[Route('/public-profile-page/{id}', name: 'app_public_profile')]
    public function subscribe(EntityManagerInterface $em, Request $request, int $id): Response
    {
        $user = $em->getRepository(User::class)->find($id);
        return $this->render('profile_page/public.html.twig', [
            'user' => $user,
        ]);
    }
}
